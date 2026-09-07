// @ts-nocheck
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireAnyUser, STAFF_ROLES } from '@/lib/auth';
import { readFileByKey, safeServeHeaders } from '@/lib/storage';

/**
 * GET /api/files/:id — выдача файла документа.
 *
 * Доступ:
 *   - владелец документа (спортсмен);
 *   - staff (admin / organizer / viewer) — проверка документов.
 *
 * Прямого публичного URL у файла НЕТ: ключ хранения (documents/<uuid>.<ext>)
 * живёт только в БД, наружу отдаётся исключительно этот маршрут.
 *
 * САМОАУДИТ ЭТАПА 5:
 *   (2.3) rate limit — файлы раздаются без кэша, каждый просмотр = запрос;
 *         ограничиваем частоту на IP (90/мин — выше любого сценария UI).
 *   (1.4) Content-Type — только из белого списка (magic bytes проверены при
 *         загрузке); неизвестный тип уходит как octet-stream + attachment.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    rateLimit(req, 'files', 90, 60_000);
    const user = await requireAnyUser();
    const { id } = await params;

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) throw ERR.NOT_FOUND('Документ не найден');

    if (doc.userId !== user.id && !STAFF_ROLES.includes(user.role)) {
      // чужой файл — не раскрываем даже его существование
      throw ERR.NOT_FOUND('Документ не найден');
    }

    let buffer: Buffer;
    try {
      buffer = await readFileByKey(doc.fileUrl);
    } catch {
      throw ERR.NOT_FOUND('Файл не найден в хранилище');
    }

    // безопасное имя для Content-Disposition (RFC 5987 — кириллица)
    const safeName = (doc.fileName || `document-${doc.id}`).replace(/[\r\n"\\]/g, '_');
    const encoded = encodeURIComponent(safeName);
    const serve = safeServeHeaders(doc.mimeType);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': serve.contentType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `${serve.disposition}; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
