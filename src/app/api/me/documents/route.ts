import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireAnyUser } from '@/lib/auth';
import {
  MAX_DOCUMENT_BYTES,
  detectDocumentType,
  saveFile,
} from '@/lib/storage';
import {
  DOCUMENT_TYPES,
  lazyExpireDocuments,
} from '@/lib/cabinet';
import { serializeDocument } from '@/lib/cabinet';

/**
 * STAGE 5 — документы спортсмена.
 *
 *   GET  /api/me/documents — список своих документов (+ ленивое истечение)
 *   POST /api/me/documents — загрузка (multipart: type, expiresAt?, file)
 *
 * Файлы лежат в объектном хранилище (src/lib/storage.ts); в БД — метаданные.
 * Отдача файлов — только через авторизованный GET /api/files/[id].
 */

export async function GET() {
  return handle(async () => {
    const user = await requireAnyUser();
    await lazyExpireDocuments(user.id);

    const docs = await db.document.findMany({
      where: { userId: user.id },
      orderBy: [{ uploadedAt: 'desc' }],
    });

    return Response.json({ documents: docs.map(serializeDocument) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireAnyUser();
    rateLimit(req, 'me-documents', 12, 60_000);

    // САМОАУДИТ ЭТАПА 5 (1.2): ранний отказ по Content-Length — formData()
    // буферизует тело запроса ДО того, как мы увидим file.size. Без этой
    // проверки крупное тело уже легло бы в память. Допуск +1 МБ на
    // multipart-обвязку (boundary, поля type/expiresAt).
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > MAX_DOCUMENT_BYTES + 1024 * 1024) {
      throw ERR.PAYLOAD_TOO_LARGE(MAX_DOCUMENT_BYTES / (1024 * 1024));
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw ERR.VALIDATION(null, 'Ожидается multipart/form-data');
    }

    // --- тип документа -----------------------------------------------------
    const type = String(form.get('type') || '');
    if (!DOCUMENT_TYPES.includes(type as any)) {
      throw ERR.VALIDATION({ type: 'Выберите тип документа' });
    }

    // --- срок действия (для медсправки) ------------------------------------
    let expiresAt: Date | null = null;
    const rawExpires = String(form.get('expiresAt') || '').trim();
    if (rawExpires) {
      const d = new Date(rawExpires);
      if (isNaN(d.getTime())) {
        throw ERR.VALIDATION({ expiresAt: 'Некорректная дата' });
      }
      if (d.getTime() < Date.now()) {
        throw ERR.VALIDATION({ expiresAt: 'Срок действия уже истёк' });
      }
      expiresAt = d;
    }

    // --- файл ---------------------------------------------------------------
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      throw ERR.VALIDATION({ file: 'Прикрепите файл' });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw ERR.PAYLOAD_TOO_LARGE(MAX_DOCUMENT_BYTES / (1024 * 1024));
    }

    // САМОАУДИТ ЭТАПА 5 (1.1): тип определяем по magic bytes, а не по
    // file.type/расширению — их задаёт клиент. Не распознали сигнатуру —
    // 415 (раньше файл с расширением .png и телом HTML сохранялся бы как
    // image/png).
    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = detectDocumentType(buffer);
    if (!sniffed) throw ERR.UNSUPPORTED_FILE();

    const ext = sniffed.ext;
    const mimeType = sniffed.mime;

    // --- save + metadata ------------------------------------------------------
    const key = await saveFile(buffer, ext);
    const doc = await db.document.create({
      data: {
        userId: user.id,
        type,
        fileUrl: key,
        fileName: file.name.slice(0, 200),
        fileSize: buffer.length,
        mimeType,
        status: 'pending',
        expiresAt,
      },
    });

    return Response.json({ document: serializeDocument(doc) }, { status: 201 });
  });
}
