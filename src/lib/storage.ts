import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';

// Константы
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 МБ

// Сохранение публичного файла
export async function savePublicFile(file: Buffer, fileName: string): Promise<string> {
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  
  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, file);
  
  return `/uploads/${fileName}`;
}

// Сохранение приватного файла
export async function savePrivateFile(file: Buffer, fileName: string): Promise<string> {
  const uploadDir = join(process.cwd(), 'private-uploads');
  await mkdir(uploadDir, { recursive: true });
  
  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, file);
  
  return `/private/${fileName}`;
}

// Сохранение файла (универсальная функция)
export async function saveFile(file: Buffer, fileName: string, isPrivate: boolean = false): Promise<string> {
  if (isPrivate) {
    return savePrivateFile(file, fileName);
  }
  return savePublicFile(file, fileName);
}

// Чтение файла по ключу
export async function readFileByKey(key: string): Promise<Buffer | null> {
  const filePath = join(process.cwd(), 'storage', key);
  
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

// Удаление файла по ключу
export async function deleteFileByKey(key: string): Promise<void> {
  const filePath = join(process.cwd(), 'storage', key);
  
  try {
    await unlink(filePath);
  } catch {
    // Файл не найден — игнорируем
  }
}

// Получение приватного файла
export async function getPrivateFileStream(fileId: string): Promise<{ stream: Buffer; contentType: string } | null> {
  const filePath = join(process.cwd(), 'private-uploads', fileId);
  
  try {
    const buffer = await readFile(filePath);
    const ext = extname(fileId).toLowerCase();
    const contentType = getContentType(ext);
    
    return { stream: buffer, contentType };
  } catch {
    return null;
  }
}

// Определение типа документа
export function detectDocumentType(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return 'image';
  }
  if (ext === '.pdf') {
    return 'pdf';
  }
  return 'document';
}

// Безопасные заголовки для отдачи файлов
export function safeServeHeaders(fileName: string, contentType?: string): Record<string, string> {
  const ext = extname(fileName).toLowerCase();
  const detectedType = contentType || getContentType(ext);
  
  return {
    'Content-Type': detectedType,
    'Content-Disposition': `inline; filename="${basename(fileName)}"`,
    'Cache-Control': 'private, max-age=3600',
  };
}

// Вспомогательная функция для определения Content-Type
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
  
  return types[ext] || 'application/octet-stream';
}

// Удаление файла по URL
export async function deleteFile(fileUrl: string): Promise<void> {
  const filePath = join(process.cwd(), 'public', fileUrl);
  
  try {
    await unlink(filePath);
  } catch {
    // Файл не найден — игнорируем
  }
}