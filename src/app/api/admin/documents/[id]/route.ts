// @ts-nocheck
import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireStaff } from '@/lib/auth';
import { sendStatusUpdate } from '@/lib/email/send';
import { DOCUMENT_STATUS_LABELS } from '@/lib/cabinet';

/**
 * PATCH /api/admin/documents/:id — решение по документу спортсмена.
 *
 * Доступ: admin | organizer (viewer — только просмотр).
 * Переходы: pending → approved | rejected; rejected → approved;
 * approved → rejected (передумали / нашлась ошибка).
 * Отклонение требует причины — спортсмен увидит её в своём кабинете.
 */

const ALLOWED = new Set(['approved', 'rejected']);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const staff = await requireStaff(['admin', 'organizer']);
    const { id } = await params;

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const status = String(body?.status || '');
    const rejectReason = typeof body?.rejectReason === 'string' ? body.rejectReason.trim() : '';

    if (!ALLOWED.has(status)) {
      throw ERR.VALIDATION({ status: 'Статус должен быть approved или rejected' });
    }
    if (status === 'rejected' && rejectReason.length < 3) {
      throw ERR.VALIDATION({ rejectReason: 'Укажите причину отклонения — спортсмен увидит её в кабинете' });
    }

    const doc = await db.document.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!doc) throw ERR.NOT_FOUND('Документ не найден');
    if (!['pending', 'approved', 'rejected'].includes(doc.status)) {
      throw ERR.VALIDATION({ status: 'Документ истёк — дождитесь повторной загрузки' });
    }

    const updated = await db.document.update({
      where: { id: doc.id },
      data: {
        status,
        rejectReason: status === 'rejected' ? rejectReason.slice(0, 500) : null,
        reviewedAt: new Date(),
        reviewedById: staff.id,
      },
    });

    // STAGE 6 §1.3 — «документ проверен»: владелец узнаёт из письма и кабинета
    if (doc.user) {
      const docLabel = { medical: 'Медсправка', federation_id: 'Удостоверение федерации', passport: 'Паспорт' }[
        doc.type
      ] || 'Документ';
      sendStatusUpdate({
        userId: doc.user.id,
        email: doc.user.email,
        name: doc.user.name,
        applicationId: doc.id,
        applicationNumber: docLabel,
        competitionName: 'Проверка документов',
        status,
        statusLabel: `${docLabel}: ${DOCUMENT_STATUS_LABELS[status] || status}`,
        comment: status === 'rejected' ? rejectReason : null,
        idempotencyPrefix: 'doc-status',
      }).catch((e) => console.error('[documents] notify failed:', e?.message));
    }

    return Response.json({
      ok: true,
      document: {
        id: updated.id,
        status: updated.status,
        rejectReason: updated.rejectReason,
        reviewedAt: updated.reviewedAt,
      },
    });
  });
}
