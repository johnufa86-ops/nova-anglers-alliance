/**
 * STAGE 4.1 — STATUS CYCLE TEST (partial unique index semantics)
 *
 *   DATABASE_URL=postgresql://... bun scripts/stage41-status-cycle-test.ts
 *
 * Test D — «отклонённая заявка освобождает e-mail»:
 *   1. подача заявки на e-mail X → 201;
 *   2. админ отклоняет заявку (с комментарием) → 200;
 *   3. повторная подача с тем же e-mail на то же соревнование → 201
 *      с НОВЫМ номером.
 *   Это доказывает корректность частичного уникального индекса:
 *   rejected/withdrawn не блокируют повторную подачу.
 *
 * Test E — обязательный комментарий при отклонении → 400.
 */

import { PrismaClient } from '@prisma/client';

const BASE = process.env.NOVA_BASE_URL || 'http://localhost:3000';
const db = new PrismaClient();

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

const EMAIL = 'resubmit@test-nova.ru';

async function submit() {
  const res = await fetch(`${BASE}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // изолированный rate-limit-бакет скрипта (см. stage41-concurrency-test)
      'X-Forwarded-For': 'test-status-cycle',
    },
    body: JSON.stringify({
      competitionId: 'test-status-cycle',
      entryType: 'athlete',
      participant: {
        firstname: 'Повторный',
        lastname: 'Тест',
        email: EMAIL,
        phone: '+7 (900) 555-66-77',
        region: 'Тестовый регион',
        city: 'Тестовый город',
        birthdate: '1988-03-03',
      },
    }),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function cleanup() {
  const comp = await db.competition.findUnique({ where: { slug: 'test-status-cycle' } });
  if (!comp) return;
  await db.application.deleteMany({ where: { competitionId: comp.id } });
  // маркер — уникальный email теста (город слишком широкий: его же
  // используют спортсмены из сьютов stage5/stage6 в ДРУГИХ соревнованиях,
  // и RESTRICT на application_participants не даёт их удалить)
  await db.athlete.deleteMany({ where: { email: EMAIL } });
  await db.competition.delete({ where: { id: comp.id } });
}

async function main() {
  console.log('\n=== STAGE 4.1 · STATUS CYCLE TESTS ===\n');

  await cleanup();
  await db.competition.create({
    data: {
      slug: 'test-status-cycle',
      name: 'TEST — цикл статусов',
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

  // ---- 1. первая подача ----
  const first = await submit();
  check('первая подача → 201', first.status === 201, first.json?.application?.applicationNumber);
  const number1 = first.json?.application?.applicationNumber;

  // ---- 2. вход админа ----
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.NOVA_ADMIN_EMAIL || 'admin@nova-anglers.ru',
      password: process.env.NOVA_ADMIN_PASSWORD || 'NovaAdmin2026!',
    }),
  });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  check('админ залогинен (cookie получен)', loginRes.status === 200 && cookie.length > 0);

  const appId = (
    await db.application.findFirst({
      where: { applicationNumber: number1 },
      select: { id: true },
    })
  )?.id;

  // ---- Test E: отклонение без комментария запрещено ----
  const rejectNoComment = await fetch(`${BASE}/api/admin/applications/${appId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'rejected' }),
  });
  const rejNoJson = await rejectNoComment.json().catch(() => null);
  check(
    'отклонение без комментария → 400',
    rejectNoComment.status === 400,
    `получено ${rejectNoComment.status}`
  );

  // ---- 3. отклонение с комментарием ----
  const rejectRes = await fetch(`${BASE}/api/admin/applications/${appId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'rejected', comment: 'Тест-отклонение 4.1' }),
  });
  check('отклонение с комментарием → 200', rejectRes.status === 200);

  // ---- 4. повторная подача тем же e-mail ----
  const second = await submit();
  const number2 = second.json?.application?.applicationNumber;
  check('повторная подача после отклонения → 201', second.status === 201, `получено ${second.status}`);
  check('новый номер отличается от прежнего', second.status === 201 && number2 !== number1, `${number1} → ${number2}`);
  const historyCount = await db.applicationStatusHistory.count({
    where: { application: { applicationNumber: number2 } },
  });
  check('у новой заявки своя история статусов', historyCount === 1);

  await cleanup();
  console.log(`\n=== ИТОГ: ${passed} ✔ / ${failed} ✘ ===\n`);
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
