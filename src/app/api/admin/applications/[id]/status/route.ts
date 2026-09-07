import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import {
  APPLICATION_STATUSES,
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  canTransition,
} from '@/lib/applications';
import { sendStatusUpdate } from '@/lib/email/send';

/**
 * PATCH /api/admin/applications/:id/status
 * Body: { status, comment }
 *
 * - allowed roles: admin, organizer (organizer must own the assignment)
 * - transition must follow ALLOWED_TRANSITIONS
 * - comment is MANDATORY for needs_changes / rejected
 * - every change is appended to application_status_history
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(['admin', 'organizer']);
    const { id } = await params;

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }
    const status = String(body?.status || '').trim();
    const comment = String(body?.comment || '').trim();

    if (!APPLICATION_STATUSES.includes(status as any)) {
      throw ERR.VALIDATION({ status: 'Неизвестный статус' });
    }

    const app = await db.application.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        competitionId: true,
        applicationNumber: true,
        userId: true,
        user: { select: { id: true, email: true, name: true } },
        competition: { select: { name: true } },
      },
    });
    if (!app) throw ERR.NOT_FOUND('Заявка не найдена');

    if (user.role === 'organizer') {
      const scope = await scopedCompetitionIds(user);
      if (scope && !scope.includes(app.competitionId)) {
        throw ERR.FORBIDDEN('Это соревнование не закреплено за вами');
      }
    }

    if (!canTransition(app.status, status)) {
      throw ERR.VALIDATION(
        { status: `Переход «${STATUS_LABELS[app.status] || app.status}» → «${STATUS_LABELS[status]}» не разрешён` },
        'Недопустимый переход статуса'
      );
    }
    if ((status === 'needs_changes' || status === 'rejected') && !comment) {
      throw ERR.VALIDATION(
        { comment: 'Комментарий обязателен' },
        'Добавьте комментарий организатора'
      );
    }

    const now = new Date();
    const [updated] = await db.$transaction([
      db.application.update({
        where: { id: app.id },
        data: {
          status,
          reviewedAt: now,
          reviewedBy: user.id,
          comment: comment || null,
        },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          oldStatus: app.status,
          newStatus: status,
          changedById: user.id,
          comment: comment || null,
          createdAt: now,
        },
      }),
    ]);

    // STAGE 6 §1.3 — уведомление спортсмену о смене статуса заявки
    // (idempotencyKey в e-mail ядре: повторная доставка/ретрай без дублей)
    if (app.user) {
      sendStatusUpdate({
        userId: app.user.id,
        email: app.user.email,
        name: app.user.name,
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        competitionName: app.competition.name,
        status,
        statusLabel: STATUS_LABELS[status] || status,
        comment: comment || null,
      }).catch((e) => console.error('[status] notify failed:', e?.message));
    }

    return Response.json({
      application: {
        id: updated.id,
        applicationNumber: updated.applicationNumber,
        status: updated.status,
        statusLabel: STATUS_LABELS[updated.status] || updated.status,
        reviewedAt: updated.reviewedAt,
        comment: updated.comment,
      },
    });
  });
}
