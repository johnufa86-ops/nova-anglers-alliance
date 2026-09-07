/**
 * STAGE 4.1 — CONCURRENCY HARDENING TEST
 *
 *   DATABASE_URL=postgresql://... bun scripts/stage41-concurrency-test.ts
 *
 * Test A — race condition на последнее место (fix #3 из аудита):
 *   maxEntries=2, 5 одновременных заявок с разными e-mail.
 *   Ожидание: ровно 2 → 201, остальные → 403 REGISTRATION_CLOSED,
 *   активных заявок в БД — ровно 2. Все номера уникальны.
 *   (До фикса проверка count шла ДО транзакции — оба «последних места»
 *   могли быть заняты.)
 *
 * Test B — гонка дублей (fix #4 из аудита):
 *   6 одновременных заявок с ОДНИМ e-mail, лимита нет.
 *   Ожидание: ровно 1 → 201, остальные → 409 DUPLICATE_APPLICATION,
 *   в БД — ровно одна активная заявка на (competition × email).
 *   (До фикса findFirst шел до транзакции; partial unique index в БД —
 *   жёсткая страховка.)
 *
 * Test C — серверная генерация номеров: формат + уникальность.
 */

import { PrismaClient } from '@prisma/client';

const BASE = process.env.NOVA_BASE_URL || 'http://localhost:3000';
const db = new PrismaClient(); // URL из .env (роль nova_app, DML достаточно)

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed++;
    console.log(`   ✔ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    console.log(`   ✘ FAIL: ${name}${extra ? ' — ' + extra : ''}`);
  }
}

const ATHLETE_BASE = {
  firstname: 'Тест',
  lastname: 'Гонка',
  phone: '+7 (900) 111-22-33',
  region: 'Тестовый регион',
  city: 'Тестовый город',
  birthdate: '1990-06-15',
};

function athletePayload(email: string) {
  return {
    ...ATHLETE_BASE,
    email,
    lastname: 'Гонка-' + email.split('@')[0].slice(-4),
  };
}

async function submit(competitionId: string, participant: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // изолированный rate-limit-бакет скрипта: limiter в памяти процесса,
      // без этого заголовка скрипт делит бакет 'local' с другими тестами,
      // запущенными в то же 60-секундное окно
      'X-Forwarded-For': 'test-concurrency',
    },
    body: JSON.stringify({ competitionId, entryType: 'athlete', participant }),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function cleanup(slug: string) {
  const comp = await db.competition.findUnique({ where: { slug } });
  if (!comp) return;
  const apps = await db.application.findMany({
    where: { competitionId: comp.id },
    select: { id: true, teamId: true },
  });
  const parts = await db.applicationParticipant.findMany({
    where: { applicationId: { in: apps.map((a) => a.id) } },
    select: { athleteId: true },
  });
  const teamIds = apps.map((a) => a.teamId).filter((t): t is string => Boolean(t));
  await db.application.deleteMany({ where: { competitionId: comp.id } }); // каскад → participants/history
  await db.athlete.deleteMany({ where: { id: { in: parts.map((p) => p.athleteId) } } });
  await db.team.deleteMany({ where: { id: { in: teamIds } } });
  await db.competition.delete({ where: { id: comp.id } });
}

async function main() {
  console.log('\n=== STAGE 4.1 · CONCURRENCY TESTS (PostgreSQL) ===\n');

  // ---------- Test A: race на последнее место ----------
  console.log('▶ Test A · гонка за последнее место (maxEntries=2, 5 одновременных)');
  const slugA = 'test-race-seats';
  await cleanup(slugA);
  const compA = await db.competition.create({
    data: {
      slug: slugA,
      name: 'TEST — гонка мест',
      discipline: 'shore',
      disciplineLabel: 'Берег',
      entryType: 'individual',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-01'),
      registrationOpenAt: new Date('2026-08-01'),
      registrationCloseAt: new Date('2026-11-30'),
      maxEntries: 2,
      status: 'registration_open',
    },
  });

  const roundA = await Promise.all(
    [1, 2, 3, 4, 5].map((i) => submit(slugA, athletePayload(`race${i}@test-nova.ru`)))
  );
  const okA = roundA.filter((r) => r.status === 201);
  const closedA = roundA.filter((r) => r.status === 403 && r.json?.error?.code === 'REGISTRATION_CLOSED');
  check('успешных заявок ровно 2', okA.length === 2, `получено ${okA.length}`);
  check('остальные отклонены REGISTRATION_CLOSED', closedA.length === 3, `получено ${closedA.length}`);
  const activeA = await db.application.count({
    where: { competitionId: compA.id, status: { in: ['submitted', 'under_review', 'needs_changes', 'approved'] } },
  });
  check('в БД ровно 2 активные заявки', activeA === 2, `в БД ${activeA}`);
  const numsA = okA.map((r) => r.json.application.applicationNumber);
  check(
    'номера в формате NOVA-ГГГГ-NNNNNN',
    numsA.every((n) => /^NOVA-\d{4}-\d{6}$/.test(n)),
    numsA.join(', ')
  );

  // ---------- Test B: гонка дублей ----------
  console.log('▶ Test B · гонка дублей (1 e-mail, 6 одновременных, без лимита)');
  const slugB = 'test-race-duplicate';
  await cleanup(slugB);
  const compB = await db.competition.create({
    data: {
      slug: slugB,
      name: 'TEST — гонка дублей',
      discipline: 'shore',
      disciplineLabel: 'Берег',
      entryType: 'individual',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-01'),
      registrationOpenAt: new Date('2026-08-01'),
      registrationCloseAt: new Date('2026-11-30'),
      maxEntries: 0,
      status: 'registration_open',
    },
  });

  const roundB = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(() => submit(slugB, athletePayload('duplicate@test-nova.ru')))
  );
  const unexpected = roundB.filter(
    (r) => r.status !== 201 && r.json?.error?.code !== 'DUPLICATE_APPLICATION'
  );
  for (const u of unexpected) {
    console.log(`   … неожиданный ответ: ${u.status} ${JSON.stringify(u.json)?.slice(0, 300)}`);
  }
  const okB = roundB.filter((r) => r.status === 201);
  const dupB = roundB.filter((r) => r.status === 409 && r.json?.error?.code === 'DUPLICATE_APPLICATION');
  check('успешных заявок ровно 1', okB.length === 1, `получено ${okB.length}`);
  check('остальные отклонены DUPLICATE_APPLICATION', dupB.length === 5, `получено ${dupB.length}`);
  const dupDetail = dupB[0]?.json?.error?.details;
  check(
    'дубликат отвечает номером существующей заявки',
    dupDetail?.applicationNumber === okB[0]?.json?.application?.applicationNumber,
    JSON.stringify(dupDetail?.applicationNumber)
  );
  const activeB = await db.application.count({
    where: { competitionId: compB.id, status: { in: ['submitted', 'under_review', 'needs_changes', 'approved'] } },
  });
  check('в БД ровно 1 активная заявка', activeB === 1, `в БД ${activeB}`);

  // ---------- Test C: уникальность номеров в БД ----------
  console.log('▶ Test C · серверная генерация и уникальность номеров');
  const grouped = await db.$queryRaw<{ n: string; c: bigint }[]>`
    SELECT "applicationNumber" AS n, COUNT(*)::bigint AS c FROM applications GROUP BY "applicationNumber" HAVING COUNT(*) > 1`;
  check('ни один номер не дублируется в БД', grouped.length === 0);
  const allNumbers = await db.application.findMany({
    select: { applicationNumber: true },
  });
  const badFormat = allNumbers.filter(
    (a) => !/^NOVA-\d{4}-\d{6}$/.test(a.applicationNumber)
  );
  check('все номера в БД соответствуют формату', badFormat.length === 0, badFormat.map((b) => b.applicationNumber).join(', '));

  // ---------- cleanup ----------
  await cleanup(slugA);
  await cleanup(slugB);
  console.log('\n→ тестовые данные удалены');

  console.log(`\n=== ИТОГ: ${passed} ✔ / ${failed} ✘ ===\n`);
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
