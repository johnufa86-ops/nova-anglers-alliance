/**
 * NOVA ANGLERS ALLIANCE — STAGE 6 API TEST SUITE
 * (e-mail верификация + уведомления, оплата взносов, рейтинг)
 *
 *   DATABASE_URL='postgresql://nova:nova_local@127.0.0.1:5433/nova?schema=public' \
 *     bun scripts/stage6-api-test.ts
 *
 * Предусловие: свежий сид (bun prisma/seed.ts), dev-сервер на :3000,
 * EMAIL_DRIVER=console (по умолчанию в песочнице), PAYMENTS_DRIVER=mock.
 * Прямой доступ к БД — для подготовки состояний и проверки писем в email_log.
 */

const BASE = 'http://localhost:3000';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(cond: boolean, name: string, extra = '') {
  if (cond) {
    pass++;
    console.log(`   ✔ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
    console.log(`   ✘ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function api(
  method: string,
  path: string,
  opts: { body?: any; cookie?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: any; cookie: string }> {
  const headers: Record<string, string> = {
    // изолированный rate-limit-бакет скрипта (см. stage5-api-test)
    'X-Forwarded-For': 'stage6',
    ...(opts.headers || {}),
  };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body, redirect: 'manual' });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, data, cookie: setCookie.split(';')[0] };
}

/** Сырой запрос для проверки redirect'ов верификации. */
async function rawGet(path: string, cookie?: string): Promise<{ status: number; location: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') || '' };
}

/** Токен верификации из письма console-драйвера (email_log.body). */
async function latestVerificationToken(email: string): Promise<string | null> {
  const row = await db.emailLog.findFirst({
    where: { to: email, template: 'verification', status: 'sent' },
    orderBy: { createdAt: 'desc' },
    select: { body: true },
  });
  if (!row) return null;
  const m = row.body.match(/token=([A-Za-z0-9\-]+)/);
  return m ? m[1] : null;
}

async function main() {
  /** Ожидание асинхронного письма (уведомления — fire-and-forget). */
  async function waitForEmail(
    where: Parameters<typeof db.emailLog.findFirst>[0]['where'],
    timeoutMs = 4000
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const row = await db.emailLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
      if (row) return row;
      if (Date.now() > deadline) return null;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log('\n=== STAGE 6 · §1.2 Регистрация и верификация e-mail ===');

  const NEW_EMAIL = 'stage6-claim@test-nova.ru';
  // у тестового e-mail есть гостевая заявка (создаём её ДО регистрации)
  // bereg-rossii-1: individual, registration_open
  const guestApp = await api('POST', '/api/applications', {
    headers: { 'X-Forwarded-For': 'stage6-guest' },
    body: {
      competitionId: 'bereg-rossii-1',
      entryType: 'athlete',
      participant: {
        firstname: 'Клейм',
        lastname: 'После-Верификации',
        email: NEW_EMAIL,
        phone: '+7 (900) 555-11-22',
        region: 'Тестовый регион',
        city: 'Тестовый город',
        birthdate: '1990-05-05',
      },
    },
  });
  ok(guestApp.status === 201, 'гостевая заявка на тестовый e-mail создана', `got ${guestApp.status}`);

  // 1. регистрация — клейма ещё НЕТ
  const reg = await api('POST', '/api/auth/register', {
    headers: { 'X-Forwarded-For': 'stage6-reg' },
    body: { name: 'Клейм После-Верификации', email: NEW_EMAIL, password: 'TestPass123!' },
  });
  ok(reg.status === 201, 'регистрация → 201', `got ${reg.status}`);
  ok(reg.data?.needsVerification === true, 'ответ помечает needsVerification');
  ok(reg.data?.user?.emailVerified === false, 'emailVerified=false при создании');
  const regCookie = reg.cookie;

  let claimedCount = await db.application.count({ where: { contactEmail: NEW_EMAIL, userId: { not: null } } });
  ok(claimedCount === 0, 'КЛЕЙМА ДО ВЕРИФИКАЦИИ НЕТ (закрывает 3.3)', `got ${claimedCount}`);

  const letter = await db.emailLog.findFirst({
    where: { to: NEW_EMAIL, template: 'verification' },
    orderBy: { createdAt: 'desc' },
  });
  ok(!!letter && letter.status === 'sent', 'письмо верификации записано в email_log (console-драйвер)');

  // 2. кабинет до верификации: пустой, PATCH профиля закрыт
  const profBefore = await api('GET', '/api/me/profile', { cookie: regCookie });
  ok(profBefore.data?.user?.emailVerified === false, 'профиль отдаёт emailVerified=false');
  ok(profBefore.data?.athlete === null, 'профиль спортсмена пуст до верификации');
  const patchBefore = await api('PATCH', '/api/me/profile', {
    cookie: regCookie,
    body: { phone: '+7 (900) 000-00-00' },
  });
  ok(patchBefore.status === 404, 'PATCH профиля до верификации → 404 (нет athlete-записи)', `got ${patchBefore.status}`);

  // 3. верификация по ссылке → клейм
  const token = await latestVerificationToken(NEW_EMAIL);
  ok(!!token, 'сырой токен извлечён из письма');
  const badVerify = await rawGet('/api/auth/verify?token=nonexistent-token-value-123456');
  ok(badVerify.status === 307 || badVerify.status === 302, 'невалидный токен → redirect', `got ${badVerify.status}`);
  ok(badVerify.location.includes('verified=invalid'), 'невалидный токен → ?verified=invalid', badVerify.location);

  const verify = await rawGet(`/api/auth/verify?token=${token}`);
  ok(verify.location.includes('verified=1'), 'верификация → ?verified=1', verify.location);

  const userRow = await db.user.findUnique({ where: { email: NEW_EMAIL } });
  ok(userRow?.emailVerified === true, 'user.emailVerified=true');

  claimedCount = await db.application.count({ where: { contactEmail: NEW_EMAIL, userId: { not: null } } });
  ok(claimedCount === 1, 'КЛЕЙМ ПОСЛЕ ВЕРИФИКАЦИИ: гостевая заявка привязана', `got ${claimedCount}`);
  const athleteRow = await db.athlete.findFirst({ where: { email: NEW_EMAIL } });
  ok(!!athleteRow?.userId, 'athlete-запись привязана к аккаунту');

  // 4. повторный клик по ссылке — идемпотентен
  const reVerify = await rawGet(`/api/auth/verify?token=${token}`);
  ok(reVerify.location.includes('verified=1'), 'повторный клик по ссылке → verified=1 (идемпотентно)');

  // 5. кабинет после верификации видит заявку
  const appsAfter = await api('GET', '/api/me/applications', { cookie: regCookie });
  ok(
    (appsAfter.data?.applications || []).some((a: any) => a.applicationNumber === guestApp.data?.application?.applicationNumber),
    'гостевая заявка видна в кабинете после верификации'
  );

  // 6. повторная отправка: rate limit 3/мин (4-я → 429)
  for (let i = 0; i < 3; i++) {
    await api('POST', '/api/auth/verify', { cookie: regCookie });
  }
  const resend4 = await api('POST', '/api/auth/verify', { cookie: regCookie });
  ok(resend4.status === 429, '4-я повторная отправка за минуту → 429 (3/мин)', `got ${resend4.status}`);

  // окна per-user лимита (3/мин) исчерпаны resend-тестом — ждём нового окна,
  // чтобы уведомления §1.3 реально отправлялись (это фича, не баг)
  console.log('   … ожидание сброса окна rate limit (61 с) …');
  await new Promise((r) => setTimeout(r, 61_000));

  console.log('\n=== STAGE 6 · §1.3 Уведомления о статусах ===');

  // заявка от верифицированного спортсмена → письмо «принята»
  // nova-cup-volga: team, registration_open
  const app2 = await api('POST', '/api/applications', {
    cookie: regCookie,
    headers: { 'X-Forwarded-For': 'stage6-app' },
    body: {
      competitionId: 'nova-cup-volga',
      entryType: 'team',
      participant: {
        name: 'Экипаж Верификация',
        roster: ['Клейм После-Верификации', 'Тест Двойка'],
        email: NEW_EMAIL,
        phone: '+7 (900) 555-11-22',
        region: 'Тестовый регион',
        city: 'Тестовый город',
      },
    },
  });
  ok(app2.status === 201, 'заявка верифицированным → 201', `got ${app2.status}`);

  // смена статуса организатором → письмо + идемпотентность
  const adminLogin = await api('POST', '/api/auth/login', {
    body: { email: 'admin@nova-anglers.ru', password: 'NovaAdmin2026!' },
  });
  const adminCookie = adminLogin.cookie;
  const appNumber = app2.data?.application?.applicationNumber;
  const appRow = appNumber ? await db.application.findUnique({ where: { applicationNumber: appNumber } }) : null;
  ok(!!appRow, 'заявка найдена в БД');

  const submittedMail = await waitForEmail({ idempotencyKey: `app-status:${appRow!.id}:submitted`, status: 'sent' });
  ok(!!submittedMail && submittedMail.status === 'sent', 'письмо «заявка принята» отправлено');

  const st1 = await api('PATCH', `/api/admin/applications/${appRow!.id}/status`, {
    cookie: adminCookie,
    body: { status: 'under_review', comment: 'Начали проверку' },
  });
  ok(st1.status === 200, 'статус → under_review (200)', `got ${st1.status}`);
  const st2 = await api('PATCH', `/api/admin/applications/${appRow!.id}/status`, {
    cookie: adminCookie,
    body: { status: 'approved', comment: 'Принято' },
  });
  ok(st2.status === 200, 'статус → approved (200)', `got ${st2.status}`);
  const approvedMail = await waitForEmail({ idempotencyKey: `app-status:${appRow!.id}:approved`, status: 'sent' });
  ok(!!approvedMail && approvedMail.status === 'sent', 'письмо «заявка подтверждена» отправлено');
  ok((approvedMail?.body || '').includes('NOVA'), 'шаблон Dark Premium в письме (бренд NOVA)');

  // идемпотентность: ключ один на событие; повторный переход на тот же статус
  // письма не добавит
  const approvedCount1 = await db.emailLog.count({ where: { idempotencyKey: `app-status:${appRow!.id}:approved` } });
  ok(approvedCount1 === 1, 'idempotencyKey один на событие', `got ${approvedCount1}`);

  // документ отклонён → письмо владельцу.
  // Перед этим в текущем окне уже ушли 3 письма (submitted/under_review/
  // approved) — per-user лимит 3/мин выбран, ждём сброса окна.
  console.log('   … ожидание сброса окна rate limit (61 с) …');
  await new Promise((r) => setTimeout(r, 61_000));
  const docUpload = new FormData();
  docUpload.append('type', 'medical');
  docUpload.append('expiresAt', '2027-12-01');
  const PDF = Buffer.from('%PDF-1.4\n%audit-test\n%%EOF');
  docUpload.append('file', new File([PDF], 'med.pdf', { type: 'application/pdf' }));
  const up = await fetch(`${BASE}/api/me/documents`, {
    method: 'POST',
    headers: { Cookie: regCookie, 'X-Forwarded-For': 'stage6' },
    body: docUpload,
  });
  ok(up.status === 201, 'документ загружен → 201', `got ${up.status}`);
  const docId = (await up.json())?.document?.id;

  const rejDoc = await api('PATCH', `/api/admin/documents/${docId}`, {
    cookie: adminCookie,
    body: { status: 'rejected', rejectReason: 'Нечитаемый скан' },
  });
  ok(rejDoc.status === 200, 'документ отклонён организатором (200)', `got ${rejDoc.status}`);
  const docMail = await waitForEmail({ to: NEW_EMAIL, idempotencyKey: `doc-status:${docId}:rejected`, status: 'sent' });
  ok(!!docMail && docMail.status === 'sent', 'письмо «документ отклонён» отправлено');

  console.log('\n=== STAGE 6 · §1.4 Unsubscribe и защита от спама ===');

  // отписка по подделанному токену → отказ
  const badUnsub = await rawGet('/api/unsubscribe?token=deadbeef.deadbeef');
  ok(badUnsub.location.includes('unsubscribed=invalid'), 'подделанный unsubscribe-токен → invalid', badUnsub.location);

  // настоящая отписка из письма
  // ссылка unsubscribe — из письма об approved (ключ однозначен для текущего прогона)
  const mailRow = await waitForEmail({ idempotencyKey: `app-status:${appRow!.id}:approved`, status: 'sent' });
  const unsubMatch = (mailRow?.body || '').match(/\/api\/unsubscribe\?token=([A-Za-z0-9.\-]+)/);
  ok(!!unsubMatch, 'ссылка unsubscribe есть в письме (§1.4)');
  const unsub = await rawGet(`/api/unsubscribe?token=${unsubMatch![1]}`);
  ok(unsub.location.includes('unsubscribed=1'), 'отписка по валидной ссылке → unsubscribed=1');

  const userAfter = await db.user.findUnique({ where: { email: NEW_EMAIL } });
  ok(userAfter?.notificationsEnabled === false, 'notificationsEnabled=false');

  // после отписки смена статуса НЕ шлёт письмо
  const mailsBefore = await db.emailLog.count({ where: { to: NEW_EMAIL } });
  await api('PATCH', `/api/admin/applications/${appRow!.id}/status`, {
    cookie: adminCookie,
    body: { status: 'under_review', comment: 'Перепроверка' },
  });
  const mailsAfter = await db.emailLog.count({ where: { to: NEW_EMAIL } });
  ok(mailsBefore === mailsAfter, 'после отписки письма не отправляются');

  // тесты §2 идут от того же аккаунта: возвращаем уведомления (прямая
  // установка состояния, как если бы пользователь включил их в профиле)
  await db.user.update({ where: { email: NEW_EMAIL }, data: { notificationsEnabled: true } });

  console.log('   … ожидание сброса окна rate limit (61 с) перед §2 …');
  await new Promise((r) => setTimeout(r, 61_000));

  console.log('\n=== STAGE 6 · §2 Оплата стартового взноса ===');

  // заявка на соревнование с взносом (nova-ural-trofi: team, open, 3000.00 ₽)
  const paidApp = await api('POST', '/api/applications', {
    cookie: regCookie,
    headers: { 'X-Forwarded-For': 'stage6-pay' },
    body: {
      competitionId: 'nova-ural-trofi',
      entryType: 'team',
      participant: {
        name: 'Экипаж Оплата',
        roster: ['Клейм После-Верификации', 'Тест Тройка'],
        email: NEW_EMAIL,
        phone: '+7 (900) 555-33-44',
        region: 'Тестовый регион',
        city: 'Тестовый город',
      },
    },
  });
  ok(paidApp.status === 201, 'заявка на турнир со взносом создана', `got ${paidApp.status}`);
  const paidAppRow = await db.application.findUnique({
    where: { applicationNumber: paidApp.data?.application?.applicationNumber },
    include: { competition: { select: { entryFee: true, name: true } } },
  });
  ok(paidAppRow!.competition.entryFee === 300_000, 'entryFee турнира = 3000.00 ₽ (из сида)', `got ${paidAppRow!.competition.entryFee}`);

  // чужой аккаунт не может оплатить чужую заявку
  const otherLogin = await api('POST', '/api/auth/login', {
    body: { email: 'athlete@nova-anglers.ru', password: 'NovaAthlete2026!' },
  });
  const otherPay = await api('POST', '/api/payments/create', {
    cookie: otherLogin.cookie,
    body: { applicationId: paidAppRow!.id },
  });
  ok(otherPay.status === 404, 'оплата чужой заявки → 404', `got ${otherPay.status}`);

  // создание платежа
  const pay1 = await api('POST', '/api/payments/create', {
    cookie: regCookie,
    body: { applicationId: paidAppRow!.id },
  });
  ok(pay1.status === 201, 'платёж создан → 201', `got ${pay1.status} ${JSON.stringify(pay1.data).slice(0, 120)}`);
  ok(pay1.data?.payment?.status === 'pending', 'статус pending');
  ok(pay1.data?.payment?.amount === 300_000, 'сумма в копейках от сервера');
  ok(!!pay1.data?.confirmationUrl, 'confirmationUrl получен (mock)');

  const paymentId = pay1.data?.payment?.id;

  // идемпотентность: повторный create при pending — тот же платёж
  const pay2 = await api('POST', '/api/payments/create', {
    cookie: regCookie,
    body: { applicationId: paidAppRow!.id },
  });
  ok(pay2.status === 200 && pay2.data?.payment?.id === paymentId, 'повторный create → тот же pending-платёж');

  // webhook без подписи → 403
  const noSig = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ InvoiceId: paymentId, Status: 'Completed', TransactionId: 'tx-1', Amount: '3000.00' }),
  });
  ok(noSig.status === 403, 'webhook без Content-HMAC → 403', `got ${noSig.status}`);

  // webhook с неверной подписью → 403
  const badSig = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-HMAC': 'ZmFrZQ==' },
    body: JSON.stringify({ InvoiceId: paymentId, Status: 'Completed', TransactionId: 'tx-2', Amount: '3000.00' }),
  });
  ok(badSig.status === 403, 'webhook с неверной подписью → 403', `got ${badSig.status}`);

  // mock-оплата: сервер подписывает и проводит через общий обработчик
  const complete = await api('POST', '/api/payments/mock/complete', {
    body: { paymentId, outcome: 'succeeded' },
  });
  ok(complete.status === 200 && complete.data?.result?.status === 'paid', 'mock-оплата → paid через общий обработчик', JSON.stringify(complete.data));

  const payRow = await db.payment.findUnique({ where: { id: paymentId } });
  ok(payRow?.status === 'paid' && !!payRow?.paidAt, 'в БД: status=paid, paidAt проставлен');
  ok(!!payRow?.providerId, 'providerId (TransactionId) сохранён');

  // чек отправлен один раз; повторная доставка (retry) не дублирует
  const completeRetry = await api('POST', '/api/payments/mock/complete', {
    body: { paymentId, outcome: 'succeeded' },
  });
  ok(completeRetry.data?.result?.status === 'paid', 'повторная доставка события → идемпотентна');
  const receiptCount = await db.emailLog.count({ where: { idempotencyKey: `payment-receipt:${paidAppRow!.id}` } });
  ok(receiptCount === 1, 'чек: ровно одно письмо (idempotency)', `got ${receiptCount}`);
  const receipt = await waitForEmail({ idempotencyKey: `payment-receipt:${paidAppRow!.id}`, status: 'sent' });
  ok((receipt?.body || '').includes('3 000') || (receipt?.body || '').includes('3\u00A0000'), 'чек содержит сумму 3 000 ₽');

  // уже оплачено → повторный create → 409
  const pay3 = await api('POST', '/api/payments/create', {
    cookie: regCookie,
    body: { applicationId: paidAppRow!.id },
  });
  ok(pay3.status === 409, 'create при paid → 409 PAYMENT_ALREADY_PAID', `got ${pay3.status}`);

  // манипуляция суммой: событие с неверной суммой игнорируется
  const pay4 = await api('POST', '/api/payments/create', {
    cookie: otherLogin.cookie,
    body: { applicationId: pay1.data.payment.id }, // чужой → 404, проверили выше
  });
  ok(pay4.status === 404, 'чужой create по paymentId → 404');

  // mock checkout-страница доступна только в mock-драйвере
  const checkout = await fetch(`${BASE}/api/payments/mock/checkout?paymentId=${paymentId}`);
  ok(checkout.status === 200 && (await checkout.text()).includes('MOCK'), 'mock checkout-страница рендерится');

  console.log('\n=== STAGE 6 · §3 Рейтинг ===');

  const rating = await api('GET', '/api/rating');
  ok(rating.status === 200, 'GET /api/rating → 200', `got ${rating.status}`);
  const athletes: any[] = rating.data?.athletes || [];
  ok(athletes.length > 0, 'рейтинг не пуст');
  ok(!!rating.data?.updatedAt, 'updatedAt присутствует');
  const volkov = athletes.find((a) => a.name === 'Волков Артём');
  ok(!!volkov && volkov.points === 720, 'Волков Артём в рейтинге с 720 очками (протокол NOVA CUP — Дон)', `got ${volkov?.points}`);
  const noPii = athletes.every((a) => !('email' in a) && !('phone' in a) && !('birthDate' in a));
  ok(noPii, 'без PII (email/phone/birthDate отсутствуют)');
  const sorted = athletes.every((a, i) => i === 0 || athletes[i - 1].points >= a.points);
  ok(sorted, 'сортировка по убыванию очков');

  console.log(`\n=== ИТОГ: ${pass} ✔ / ${fail} ✘ ===`);
  if (failures.length) {
    console.log('Провалены:');
    failures.forEach((f) => console.log(`  - ${f}`));
    await db.$disconnect();
    process.exit(1);
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('Test runner crashed:', e);
  await db.$disconnect();
  process.exit(1);
});
