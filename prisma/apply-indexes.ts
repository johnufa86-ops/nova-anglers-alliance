/**
 * NOVA ANGLERS ALLIANCE — DB-level guarantees that Prisma DSL cannot express.
 *
 *   bun prisma/apply-indexes.ts
 *
 * 1. Partial unique index: one ACTIVE application per (competition, contact e-mail).
 *    Rejected/withdrawn applications free the e-mail up for a re-submission.
 *    This is the hard DB guarantee behind the API duplicate check — even two
 *    perfectly concurrent submissions cannot both win (see Stage 4.1 audit).
 *
 * 2. (future-proofing spot) — add more partial/conditional indexes here.
 *
 * Idempotent: uses CREATE UNIQUE INDEX IF NOT EXISTS. Run after every
 * `prisma db push` / migration (also embedded in supabase/schema.sql).
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('→ applying DB-level guarantees …');

  // One active application per competition + normalized contact e-mail.
  // NOTE: identifiers are quoted — Prisma db push creates camelCase columns.
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS applications_active_contact_uniq
      ON applications ("competitionId", "contactEmail")
      WHERE status NOT IN ('rejected', 'withdrawn')
  `);
  console.log('   ✔ applications_active_contact_uniq (partial unique index)');

  console.log('✔ done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
