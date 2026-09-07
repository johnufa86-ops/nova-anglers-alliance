/**
 * STAGE 6 — общий обработчик webhook-событий провайдера.
 *
 * Используется двумя маршрутами:
 *   POST /api/payments/webhook   — настоящий провайдер (после проверки HMAC)
 *   POST /api/payments/mock/complete — mock-драйвер (сервер сам подписывает)
 *
 * Идемпотентность: финальные статусы не перезаписываются, чек уходит
 * один раз (idempotencyKey `payment-receipt:<applicationId>`).
 */

import { db } from '@/lib/db';
import { parseWebhookEvent, verifyWebhookSignature, type WebhookEvent } from '@/lib/payments';
import { sendPaymentReceipt } from '@/lib/email/send';

export interface ProcessResult {
  ok: boolean;
  ignored?: string | null;
  status?: string;
}

/** Проверка подписи + обработка события. */
export async function processWebhookEvent(rawBody: Buffer, signature: string | null): Promise<ProcessResult> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    const err = new Error('INVALID_SIGNATURE') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  const event: WebhookEvent = parseWebhookEvent(rawBody);
  if (event.event === 'unknown' || !event.internalPaymentId) {
    console.warn('[payments] unparsed event:', event.event, event.internalPaymentId);
    return { ok: true, ignored: 'unparsed' };
  }

  const payment = await db.payment.findUnique({
    where: { id: event.internalPaymentId },
    include: {
      application: {
        select: {
          id: true,
          applicationNumber: true,
          userId: true,
          competition: { select: { name: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });
  if (!payment) {
    console.warn('[payments] unknown payment:', event.internalPaymentId);
    return { ok: true, ignored: 'unknown-payment' };
  }

  // контроль суммы: событие не в состоянии изменить сумму счёта
  if (event.amountKopecks != null && event.amountKopecks !== payment.amount) {
    console.error(
      `[payments] amount mismatch for ${payment.id}: got ${event.amountKopecks}, expected ${payment.amount}`
    );
    return { ok: true, ignored: 'amount-mismatch' };
  }

  switch (event.event) {
    case 'PaymentSucceeded': {
      if (payment.status === 'paid') return { ok: true, status: 'paid' }; // идемпотентно
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          ...(event.providerPaymentId ? { providerId: event.providerPaymentId } : {}),
          refundReason: null,
        },
      });
      // чек спортсмену — один раз на заявку (ключ в e-mail ядре)
      if (payment.application.user) {
        await sendPaymentReceipt({
          userId: payment.application.user.id,
          email: payment.application.user.email,
          name: payment.application.user.name,
          applicationId: payment.application.id,
          applicationNumber: payment.application.applicationNumber,
          competitionName: payment.application.competition.name,
          amountKopecks: payment.amount,
          currency: payment.currency,
          providerId: event.providerPaymentId ?? payment.providerId,
        }).catch((e) => console.error('[payments] receipt email failed:', e?.message));
      }
      return { ok: true, status: 'paid' };
    }
    case 'PaymentFailed': {
      if (payment.status === 'pending') {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            ...(event.reason ? { refundReason: event.reason.slice(0, 300) } : {}),
          },
        });
      }
      return { ok: true, status: payment.status };
    }
    case 'PaymentRefunded': {
      if (payment.status === 'paid') {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
            refundReason: (event.reason || 'Возврат по операции провайдера').slice(0, 300),
          },
        });
      }
      return { ok: true, status: payment.status };
    }
  }
}
