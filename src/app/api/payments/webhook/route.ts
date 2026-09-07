import { NextResponse } from 'next/server';
import { processWebhookEvent } from '@/lib/payments-webhook';

/**
 * STAGE 6 §2.1 — POST /api/payments/webhook
 *
 * Уведомления провайдера (CloudPayments): Pay / Fail / Refund.
 *
 * Безопасность: HMAC-подпись Content-HMAC (base64 HMAC-SHA256 над СЫРЫМ
 * телом запроса, secret провайдера) проверяется через timingSafeEqual —
 * невалидная подпись → 403, событие не обрабатывается.
 *
 * Идемпотентность: повторная доставка не меняет финальный статус и не
 * дублирует чек (ключ payment-receipt:<applicationId> в e-mail ядре).
 * Провайдеру возвращается 200 при любой валидно подписанной доставке
 * (иначе он бесконечно ретраит), 403 — только при плохой подписи.
 */

export async function POST(req: Request) {
  const raw = new Uint8Array(await req.arrayBuffer());
  const rawBody = Buffer.from(raw);

  const signature =
    req.headers.get('content-hmac') || req.headers.get('x-content-hmac') || req.headers.get('x-signature');

  try {
    const result = await processWebhookEvent(rawBody, signature);
    return NextResponse.json({ ...result, code: 0 });
  } catch (e: any) {
    if (e?.statusCode === 403) {
      return NextResponse.json({ error: { code: 'INVALID_SIGNATURE' } }, { status: 403 });
    }
    console.error('[payments/webhook] processing error:', e?.message);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }
}
