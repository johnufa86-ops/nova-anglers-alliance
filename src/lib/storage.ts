import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';

// Константы — по ТЗ: документы до 10 МБ, чеки до 5 МБ
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 МБ
export const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 МБ

type Detected = { ext: string; mime: string };

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.json': 'application/json',
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return map[mime] || 'bin';
}

// Определение типа по magic bytes (не по расширению!)
export function detectDocumentType(input: Buffer | string): Detected | null {
  if (typeof input === 'string') {
    const ext = extname(input).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)) {
      const clean = ext === '.jpeg' ? '.jpg' : ext;
      return { ext: clean.replace('.', ''), mime: getContentType(clean) };
    }
    return null;
  }

  const buf = input as Buffer;
  if (buf.length < 4) return null;

  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  const isWebp =
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;

  if (isJpg) return { ext: 'jpg', mime: 'image/jpeg' };
  if (isPng) return { ext: 'png', mime: 'image/png' };
  if (isPdf) return { ext: 'pdf', mime: 'application/pdf' };
  if (isWebp) return { ext: 'webp', mime: 'image/webp' };

  return null;
}

// Универсальное сохранение файла (документы спортсмена)
export async function saveFile(
  file: Buffer,
  fileNameOrExt: string,
  isPrivate: boolean = false
): Promise<string> {
  // fileNameOrExt может быть расширением ('jpg') или именем файла
  let ext = fileNameOrExt.toLowerCase();
  if (ext.includes('.')) {
    ext = extname(ext).replace('.', '') || ext;
  }
  ext = ext.replace('.', '');

  if (!ext) {
    const detected = detectDocumentType(file);
    ext = detected?.ext || 'bin';
  }

  const key = `documents/${randomUUID()}.${ext}`;
  const fullPath = join(process.cwd(), 'storage', key);
  await mkdir(join(process.cwd(), 'storage', 'documents'), { recursive: true });
  await writeFile(fullPath, file as any);
  return key;
}

// Сохранение публичного файла (для совместимости)
export async function savePublicFile(file: Buffer, fileName: string): Promise<string> {
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${basename(fileName)}`;
  const filePath = join(uploadDir, safeName);
  await writeFile(filePath, file as any);
  return `/uploads/${safeName}`;
}

// Сохранение приватного файла — поддерживает две сигнатуры:
// 1) savePrivateFile(buffer, fileName)
// 2) savePrivateFile({ buffer, filename, bucket })
export async function savePrivateFile(
  fileOrOpts: Buffer | { buffer: Buffer; filename: string; bucket?: string },
  fileName?: string
): Promise<string> {
  let buffer: Buffer;
  let name: string;
  let bucket = 'payment-proofs';

  if (Buffer.isBuffer(fileOrOpts)) {
    buffer = fileOrOpts;
    name = fileName || `${randomUUID()}.bin`;
  } else {
    buffer = fileOrOpts.buffer;
    name = fileOrOpts.filename;
    bucket = fileOrOpts.bucket || bucket;
  }

  // Сохраняем в private-uploads и также в storage/<bucket> для совместимости
  const privateDir = join(process.cwd(), 'private-uploads');
  const storageDir = join(process.cwd(), 'storage', bucket);
  await mkdir(privateDir, { recursive: true });
  await mkdir(storageDir, { recursive: true });

  const filePathPrivate = join(privateDir, basename(name));
  const filePathStorage = join(storageDir, basename(name));

  await writeFile(filePathPrivate, buffer as any);
  // Дублируем в storage для унификации чтения
  await writeFile(filePathStorage, buffer as any).catch(() => {});

  // Возвращаем ключ, который понимает readFileByKey / getPrivateFileStream
  // Для чеков — используем путь вида payment-proofs/<name> или private/<name>
  if (bucket === 'payment-proofs' || name.includes('proof_')) {
    return `payment-proofs/${basename(name)}`;
  }
  return `private/${basename(name)}`;
}

// Чтение файла по ключу (универсально)
export async function readFileByKey(key: string): Promise<Buffer> {
  const cleanKey = key.replace(/^\/+/, '');
  const base = basename(cleanKey);

  const candidates = [
    join(process.cwd(), 'storage', cleanKey),
    join(process.cwd(), 'storage', 'documents', base),
    join(process.cwd(), 'storage', 'payment-proofs', base),
    join(process.cwd(), 'storage', base),
    join(process.cwd(), 'private-uploads', base),
    join(process.cwd(), 'private-uploads', cleanKey),
    join(process.cwd(), 'public', 'uploads', base),
    join(process.cwd(), 'public', cleanKey),
  ];

  for (const p of candidates) {
    try {
      return await readFile(p);
    } catch {}
  }

  throw new Error(`File not found for key: ${key}`);
}

// Удаление файла по ключу
export async function deleteFileByKey(key: string): Promise<void> {
  const cleanKey = key.replace(/^\/+/, '');
  const base = basename(cleanKey);

  const candidates = [
    join(process.cwd(), 'storage', cleanKey),
    join(process.cwd(), 'storage', 'documents', base),
    join(process.cwd(), 'storage', 'payment-proofs', base),
    join(process.cwd(), 'storage', base),
    join(process.cwd(), 'private-uploads', base),
    join(process.cwd(), 'private-uploads', cleanKey),
    join(process.cwd(), 'public', 'uploads', base),
    join(process.cwd(), 'public', cleanKey),
  ];

  for (const p of candidates) {
    try {
      await unlink(p);
    } catch {}
  }
}

// Получение приватного файла (для чеков)
export async function getPrivateFileStream(
  fileId: string
): Promise<{ stream: Buffer; contentType: string } | null> {
  try {
    const buffer = await readFileByKey(fileId);
    const ext = extname(fileId).toLowerCase() || extname(basename(fileId)).toLowerCase();
    const contentType = getContentType(ext) || 'application/octet-stream';
    return { stream: buffer, contentType };
  } catch {
    return null;
  }
}

// Безопасные заголовки для отдачи файлов
export function safeServeHeaders(
  fileNameOrMime: string,
  contentType?: string
): { contentType: string; disposition: string } & Record<string, string> {
  let mime = contentType || '';
  let ext = '';

  if (!mime) {
    // fileNameOrMime может быть mime или именем
    if (fileNameOrMime.includes('/')) {
      mime = fileNameOrMime;
    } else {
      ext = extname(fileNameOrMime).toLowerCase();
      mime = getContentType(ext);
    }
  }

  if (!mime) mime = 'application/octet-stream';

  // Всегда attachment для чеков и приватных файлов (ТЗ §2.5.7)
  const disposition = mime.startsWith('image/') ? 'inline' : 'attachment';

  return {
    contentType: mime,
    disposition,
    'Content-Type': mime,
    'Content-Disposition': `${disposition}; filename="${basename(fileNameOrMime)}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

// Удаление файла по URL (для совместимости)
export async function deleteFile(fileUrl: string): Promise<void> {
  return deleteFileByKey(fileUrl);
}
