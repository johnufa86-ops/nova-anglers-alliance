import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireAnyUser, STAFF_ROLES } from '@/lib/auth';

/**
 * STAGE 6 — GET /api/payments/status?applicationId=...
 * Статус платежа по заявке (для поллинга фронтендом после возврата
 * со страницы оплаты). Доступ: владелец заявки или staff.
 */

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireAnyUser();
    rateLimit(req, 'payments-status', 60, 60_000);

    const url = new URL(req.url);
    const applicationId = String(url.searchParams.get('applicationId') || '');
    if (!applicationId) throw ERR.VALIDATION({ applicationId: 'Укажите заявку' });

    const app = await db.application.findUnique({
      where: { id: applicationId },
      select: { userId: true, payment: true },
    });
    if (!app || (!app.payment && app.userId !== user.id && !STAFF_ROLES.includes(user.role))) {
      // чужая заявка без платежа — 404; чужая с платежом — только staff/owner
      if (!app || (app.userId !== user.id && !STAFF_ROLES.includes(user.role))) {
        throw ERR.NOT_FOUND('Заявка не найдена');
      }
    }

    return Response.json({ payment: app.payment ?? null });
  });
}
