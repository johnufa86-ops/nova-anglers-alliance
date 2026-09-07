import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireAnyUser } from '@/lib/auth';
import { deleteFileByKey } from '@/lib/storage';

/**
 * DELETE /api/me/documents/:id — удалить свой документ.
 *
 * Разрешено для pending / rejected / expired. Документ со статусом
 * approved удалить нельзя — он уже принят организатором и является частью
 * «спортивной книжки» (перезагрузка такого типа документов поверх — можно).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireAnyUser();
    rateLimit(req, 'me-documents-del', 20, 60_000);
    const { id } = await params;

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== user.id) throw ERR.NOT_FOUND('Документ не найден');
    if (doc.status === 'approved') {
      throw ERR.FORBIDDEN('Документ уже принят организатором и не может быть удалён');
    }

    await deleteFileByKey(doc.fileUrl);
    await db.document.delete({ where: { id: doc.id } });

    return Response.json({ ok: true });
  });
}
