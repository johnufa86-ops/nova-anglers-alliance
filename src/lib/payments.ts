/**
 * STAGE 6 §2 — стартовые взносы. Абстракция платёжного провайдера.
 *
 * Драйверы (PAYMENTS_DRIVER):
 *   cloudpayments — CloudPayments REST API (ключи CLOUDPAYMENTS_PUBLIC_ID /
 *                   CLOUDPAYMENTS_API_SECRET, ТОЛЬКО server-side env).
 *                   Счёт создаётся /v1/orders/create (Idempotence-Key),
 *                   плательщик идёт на страницу оплаты из ответа Model.Url.
 *   mock          — dev/песочница: без внешних вызовов. confirmationUrl
 *                   ведёт на локальную тестовую страницу оплаты
 *                   (/api/payments/mock/checkout), которая завершает
 *                   платёж внутренним подписанным webhook-событием.
 *                   ПОЗВОЛЯЕТ прогонять E2E-цепочку оплаты в песочнице.
 *                   Запрещено включать в проде (fail-fast).
 *
 * Webhook (§2.1): POST /api/payments/webhook защищён HMAC-SHA256
 * подписью провайдера (заголовок Content-HMAC, base64) над СЫРЫМ телом
 * запроса — проверка через timingSafeEqual. Обработчик события
 * идемпотентен: повторная доставка не меняет уже оплаченный платёж
 * и не шлёт второй чек (idempotencyKey в e-mail ядре).
 *
 * Суммы: в БД — копейки (Int), в API провайдера — рубли с точностью
 * до копейки (строка '5000.00').
 */

import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const PAYMENTS_DRIVER = (process.env.PAYMENTS_DRIVER || '').trim().toLowerCase() ||
  (process.env.CLOUDPAYMENTS_API_SECRET ? 'cloudpayments' : 'mock');

const CP_PUBLIC_ID = process.env.CLOUDPAYMENTS_PUBLIC_ID || '';
const CP_API_SECRET = process.env.CLOUDPAYMENTS_API_SECRET || '';
/** Секрет mock-драйвера — только для песочницы, в проде fail-fast. */
const MOCK_SECRET = 'mock-secret-dev-only';

export function assertPaymentsConfig(): void {
  if (PAYMENTS_DRIVER === 'cloudpayments' && (!CP_PUBLIC_ID || !CP_API_SECRET)) {
    throw new Error('PAYMENTS_DRIVER=cloudpayments, но CLOUDPAYMENTS_PUBLIC_ID / CLOUDPAYMENTS_API_SECRET не заданы');
  }
  if (PAYMENTS_DRIVER === 'mock' && process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== '1') {
    throw new Error('PAYMENTS_DRIVER=mock запрещён в production (ALLOW_MOCK_PAYMENTS=1, чтобы снять)');
  }
}

export interface CreatePaymentResult {
  providerPaymentId: string | null;
  confirmationUrl: string | null;
}

/** Копейки → строка рублей для API провайдера. */
export function kopecksToRubles(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

/** Создание счёта у провайдера. */
export async function providerCreatePayment(opts: {
  paymentId: string;
  amountKopecks: number;
  currency: string;
  description: string;
  returnUrl: string;
  failUrl: string;
}): Promise<CreatePaymentResult> {
  assertPaymentsConfig();

  if (PAYMENTS_DRIVER === 'mock') {
    return {
      providerPaymentId: `mock-${randomUUID().slice(0, 8)}`,
      confirmationUrl: `/api/payments/mock/checkout?paymentId=${encodeURIComponent(opts.paymentId)}`,
    };
  }

  // --- CloudPayments: инвойс + страница оплаты ------------------------
  const res = await fetch('https://api.cloudpayments.ru/v1/orders/create', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${CP_PUBLIC_ID}:${CP_API_SECRET}` as any).toString('base64')}`,
      'Content-Type': 'application/json',
      'Idempotence-Key': opts.paymentId, // повторный вызов не создаёт второй счёт
    },
    body: JSON.stringify({
      Amount: kopecksToRubles(opts.amountKopecks),
      Currency: opts.currency,
      Description: opts.description,
      InvoiceId: opts.paymentId, // вернётся в уведомлении как InvoiceId
      SendEmail: false,
      SuccessRedirectUrl: opts.returnUrl,
      FailRedirectUrl: opts.failUrl,
    }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.Success) {
    throw new Error(`CloudPayments orders/create failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  return {
    providerPaymentId: json.Model?.Id != null ? String(json.Model.Id) : null,
    confirmationUrl: json.Model?.Url || null,
  };
}

// ------------------------------------------------------------
// webhook: парсинг + HMAC + нормализация события
// ------------------------------------------------------------

export interface WebhookEvent {
  event: 'PaymentSucceeded' | 'PaymentFailed' | 'PaymentRefunded' | 'unknown';
  internalPaymentId: string | null; // наш payment.id (приходит как InvoiceId)
  providerPaymentId: string | null; // TransactionId провайдера
  amountKopecks: number | null;
  reason?: string | null;
}

/** Content-HMAC provайдера: base64(HMAC-SHA256(rawBody, secret)). */
export function verifyWebhookSignature(rawBody: Buffer, headerValue: string | null): boolean {
  if (!headerValue) return false;
  const secret = PAYMENTS_DRIVER === 'mock' ? MOCK_SECRET : CP_API_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody as any).digest('base64');
  const given = headerValue.trim();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given) as any, Buffer.from(expected) as any);
}

/**
 * Нормализация уведомления. CloudPayments шлёт form-urlencoded
 * (Check/Pay/Fail/Refund); mock-драйвер — JSON. Разбираем оба.
 */
export function parseWebhookEvent(rawBody: Buffer): WebhookEvent {
  const text = rawBody.toString('utf8');
  let fields: Record<string, string> = {};

  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      fields = Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v ?? '')]));
    }
  } catch {
    // form-urlencoded
    fields = Object.fromEntries(new URLSearchParams(text).entries());
  }

  const status = (fields.Status || '').toLowerCase();
  let event: WebhookEvent['event'] = 'unknown';
  if ((fields.Event || '').includes('Refund') || (fields.RefundedAmount && status !== 'completed')) {
    event = 'PaymentRefunded';
  } else if (status === 'completed' || (fields.Event || '').includes('Succeeded')) {
    event = 'PaymentSucceeded';
  } else if (['cancelled', 'declined', 'failed'].includes(status) || (fields.Event || '').includes('Failed')) {
    event = 'PaymentFailed';
  }

  return {
    event,
    internalPaymentId: fields.InvoiceId || null,
    providerPaymentId: fields.TransactionId || null,
    amountKopecks: fields.Amount ? Math.round(parseFloat(fields.Amount) * 100) : null,
    reason: fields.Reason || fields.ReasonCode || null,
  };
}
