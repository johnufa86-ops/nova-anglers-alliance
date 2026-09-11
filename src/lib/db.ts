import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

// ---------------------------------------------------------------------------
// STAGE 4.1/5 — DATABASE_URL resolution.
// Песочница платформы предустанавливает шаблонный DATABASE_URL (SQLite file:...)
// прямо в окружении процесса-супервизора. Переменная из окружения имеет
// приоритет над .env при загрузке Next.js, поэтому схема postgresql
// получала бы sqlite-URL и падала. Правило: если DATABASE_URL отсутствует
// или указывает на файл (шаблон), берём значение из .env проекта.
// В реальном деплое (Supabase) DATABASE_URL задаётся корректно и не трогается.
// ---------------------------------------------------------------------------
const DEFAULT_DATABASE_URL =
  'postgresql://postgres.oaarqdjbdeczzgzpbagi:iNA-KhT-MZx-6R9@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?pgbouncer=true';

function getCleanDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || '';
  if (!url || url.startsWith('file:')) {
    const envPath = path.join(process.cwd(), '.env');
    if (existsSync(envPath)) {
      const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m);
      if (match) {
        url = match[1];
      }
    }
  }
  url = url.trim().replace(/^["']|["']$/g, '').trim();
  return url || DEFAULT_DATABASE_URL;
}

process.env.DATABASE_URL = getCleanDatabaseUrl();

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

  const isPostgres = url.startsWith('postgres') || url.startsWith('postgresql')

  if (isPostgres) {
    try {
      let adapter: any
      try {
        const poolConfig: any = { connectionString: url }
        if (url.includes('supabase.com') || url.includes('pooler')) {
          poolConfig.ssl = { rejectUnauthorized: false }
        }
        const pool = globalForPrisma.pgPool ?? new Pool(poolConfig)
        if (!globalForPrisma.pgPool) globalForPrisma.pgPool = pool
        adapter = new PrismaPg(pool)
      } catch {
        adapter = new (PrismaPg as any)({ connectionString: url })
      }
      return new PrismaClient({
        adapter,
        log:
          process.env.NODE_ENV === 'production'
            ? ['error', 'warn']
            : ['error', 'warn', 'query'],
      })
    } catch (e) {
      console.warn('[db] failed to init pg adapter, fallback to default client', e)
    }
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['error', 'warn', 'query'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
