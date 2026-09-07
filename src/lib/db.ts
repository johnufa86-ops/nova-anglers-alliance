import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ---------------------------------------------------------------------------
// STAGE 4.1/5 — DATABASE_URL resolution.
//
// Песочница платформы предустанавливает шаблонный DATABASE_URL (SQLite file:...)
// прямо в окружении процесса-супервизора. Переменная из окружения имеет
// приоритет над .env при загрузке Next.js, поэтому схема postgresql
// получала бы sqlite-URL и падала. Правило: если DATABASE_URL отсутствует
// или указывает на файл (шаблон), берём значение из .env проекта.
// В реальном деплое (Supabase) DATABASE_URL задаётся корректно и не трогается.
// ---------------------------------------------------------------------------
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const envPath = path.join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)
    if (match) {
      // тримим пробелы и опциональные кавычки (стандартный формат .env)
      const url = match[1].trim().replace(/^["']|["']$/g, '')
      if (url) process.env.DATABASE_URL = url
    }
  }
}

// Stage 4.1: query logging only in dev — in production it would leak
// payloads into logs and add overhead.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['error', 'warn', 'query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
