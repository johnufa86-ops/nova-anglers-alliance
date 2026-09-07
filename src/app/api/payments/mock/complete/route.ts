import { createHmac } from 'crypto';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { processWebhookEvent } from '@/lib/payments-webhook';

/**
 * STAGE 6 §2 (dev) — POST /api/payments/mock/complete  { paymentId, outcome }
 *
 * Завершает mock-платёж: сервер САМ подписывает событие секретом
 * mock-драйвера и передаёт в общий обработчик webhook-событий —
 * тот же путь, что у настоящего провайдера (HMAC → парсинг → статус → чек).
 * Доступно только при PAYMENTS_DRIVER=mock (fail-fast иначе).
 */

export async function POST(req: Request) {
  return handle(async () => {
    const { PAYMENTS_DRIVER } = await import('@/lib/payments');
    if (PAYMENTS_DRIVER !== 'mock') {
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: { code: 'VALIDATION' } }, { status: 400 });
    }
    const paymentId = String(body?.paymentId || '');
    const outcome = String(body?.outcome || 'succeeded');
    if (!paymentId) return Response.json({ error: { code: 'VALIDATION' } }, { status: 400 });

    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    const transactionId = `mock-tx-${Math.floor(Math.random() * 1_000_000)}`;
    const fields: Record<string, string> = {
      TransactionId: transactionId,
      InvoiceId: payment.id,
      Amount: (payment.amount / 100).toFixed(2),
      Currency: payment.currency,
    };
    if (outcome === 'succeeded') {
      fields.Status = 'Completed';
    } else {
      fields.Status = 'Declined';
      fields.Reason = 'Тестовое отклонение';
    }

    const rawBody = Buffer.from(JSON.stringify(fields), 'utf8');
    const signature = createHmac('sha256', 'mock-secret-dev-only').update(rawBody).digest('base64');

    let result;
    try {
      result = await processWebhookEvent(rawBody, signature);
    } catch (e: any) {
      if (e?.statusCode === 403) {
        return Response.json({ error: { code: 'INVALID_SIGNATURE' } }, { status: 403 });
      }
      throw e;
    }
    return Response.json({ ok: true, result });
  });
}
