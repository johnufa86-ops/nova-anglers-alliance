/**
 * NOVA ANGLERS ALLIANCE — STAGE 5 API TEST SUITE
 *
 *   DATABASE_URL='postgresql://nova:nova_local_dev@127.0.0.1:5433/nova?schema=public' \
 *     bun scripts/stage5-api-test.ts
 *
 * Предусловие: свежий сид (bun prisma/seed.ts) и запущенный dev-сервер
 * на :3000. Скрипт использует и API, и прямой доступ к БД (подготовка
 * специфических состояний: EMAIL_CLAIMED, approved-документ).
 */

const BASE = 'http://localhost:3000';

// ------------------------------------------------------------
// tiny test helpers
// ------------------------------------------------------------

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

function cookieOf(res: { cookie: string }): string {
  return res.cookie;
}

async function api(
  method: string,
  path: string,
  opts: { body?: any; cookie?: string; form?: FormData } = {}
): Promise<{ status: number; data: any; cookie: string }> {
  const headers: Record<string, string> = {
    // изолированный rate-limit-бакет скрипта (limiter в памяти процесса):
    // без заголовка сцит делит бакет 'local' с другими сьютами, идущими
    // в то же минутное окно — ловим ложные 429
    'X-Forwarded-For': 'stage5',
  };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
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

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Size 2/Root 1 0 R>>\n%%EOF'
);

// ------------------------------------------------------------
// main
// ------------------------------------------------------------

async function main() {
  // STAGE 6: клейм — только после верификации e-mail; письма уходит в email_log
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();

  /** Верификация по ссылке из письма (console-драйвер пишет тело в email_log). */
  async function verifyFromEmail(email: string): Promise<{ location: string } | null> {
    const row = await db.emailLog.findFirst({
      where: { to: email, template: 'verification', status: 'sent' },
      orderBy: { createdAt: 'desc' },
      select: { body: true },
    });
    const m = row?.body.match(/token=([A-Za-z0-9\-]+)/);
    if (!m) return null;
    const res = await fetch(`${BASE}/api/auth/verify?token=${m[1]}`, { redirect: 'manual' });
    return { location: res.headers.get('location') || '' };
  }

  console.log('\n=== STAGE 5 — регистрация и Profile Claiming (после верификации, Stage 6) ===');

  // 1.1 регистрация спортсмена с e-mail из гостевой заявки:
  //     аккаунт создаётся, клейм — ТОЛЬКО после подтверждения адреса
  let reg = await api('POST', '/api/auth/register', {
    body: { name: 'Миронов Виктор Петрович', email: 'v.mironov@mail.ru', password: 'TestPass123!' },
  });
  const mironovCookie = cookieOf(reg);
  ok(reg.status === 201, 'регистрация → 201', `got ${reg.status} ${JSON.stringify(reg.data)}`);
  ok(reg.data?.user?.role === 'athlete', 'роль по умолчанию — athlete');
  ok(reg.data?.needsVerification === true, 'ответ помечает needsVerification (Stage 6)');
  ok(reg.data?.user?.emailVerified === false, 'emailVerified=false до подтверждения');

  const profCheck = await api('GET', '/api/me/profile', { cookie: mironovCookie });
  ok(profCheck.status === 200, 'сессия установлена (cookie работает)', `got ${profCheck.status}`);
  ok(
    profCheck.data?.athlete === null && profCheck.data?.user?.emailVerified === false,
    'до верификации кабинет пуст (клейма нет)'
  );

  const verified1 = await verifyFromEmail('v.mironov@mail.ru');
  ok(!!verified1 && verified1.location.includes('verified=1'), 'верификация по ссылке → verified=1', verified1?.location);

  // 1.2 после верификации профиль подтянул данные claimed-спортсмена
  const profAfter = await api('GET', '/api/me/profile', { cookie: mironovCookie });
  ok(
    profAfter.data?.athlete?.displayName === 'Миронов Виктор' &&
      profAfter.data?.athlete?.club === 'Клуб «Каспий Про»',
    'профиль = данные claimed-спортсмена (после верификации)',
    `got ${JSON.stringify(profAfter.data?.athlete)}`
  );
  ok(profAfter.data?.stats?.applicationsTotal === 1, 'в кабинете 1 заявка', `got ${profAfter.data?.stats?.applicationsTotal}`);

  // 1.3 история заявок содержит номер гостевой заявки
  const mironovApps = await api('GET', '/api/me/applications', { cookie: mironovCookie });
  const nums = (mironovApps.data?.applications || []).map((a: any) => a.applicationNumber);
  ok(nums.includes('NOVA-2026-000003'), 'история заявок: NOVA-2026-000003', `got ${nums.join(',')}`);

  // 1.4 повторная регистрация на тот же e-mail → 409 EMAIL_TAKEN
  const dup = await api('POST', '/api/auth/register', {
    body: { name: 'Дубль Миронов', email: 'v.mironov@mail.ru', password: 'TestPass123!' },
  });
  ok(dup.status === 409 && dup.data?.error?.code === 'EMAIL_TAKEN', 'дубликат e-mail → 409 EMAIL_TAKEN', `got ${dup.status} ${dup.data?.error?.code}`);

  // 1.5 EMAIL_CLAIMED на верификации: запись спортсмена уже привязана
  //     к другому user_id (состояние готовим напрямую в БД).
  //     STAGE 6: регистрация проходит (201), конфликт обнаруживается
  //     при верификации → redirect ?verified=claimed
  const holder = await db.user.create({
    data: { email: 'holder@nova-test.ru', passwordHash: 'scrypt:00:00', name: 'Holder', role: 'athlete' },
  });
  await db.athlete.create({
    data: { displayName: 'Занятый Спортсмен', email: 'claimed@nova-test.ru', userId: holder.id },
  });
  const claimedTry = await api('POST', '/api/auth/register', {
    body: { name: 'Поздний Заявитель', email: 'claimed@nova-test.ru', password: 'TestPass123!' },
  });
  ok(claimedTry.status === 201, 'регистрация на занятый клейм → 201 (конфликт на верификации)', `got ${claimedTry.status}`);
  const claimedVerify = await verifyFromEmail('claimed@nova-test.ru');
  ok(
    !!claimedVerify && claimedVerify.location.includes('verified=claimed'),
    'верификация занятого клейма → ?verified=claimed (EMAIL_CLAIMED-семантика)',
    claimedVerify?.location
  );
  await db.athlete.deleteMany({ where: { email: 'claimed@nova-test.ru' } });
  await db.user.deleteMany({ where: { email: 'holder@nova-test.ru' } });

  // 1.6 свежий e-mail без истории → user + athlete после верификации
  reg = await api('POST', '/api/auth/register', {
    body: { name: 'Новый Спортсмен', email: 'fresh@nova-test.ru', password: 'TestPass123!' },
  });
  const freshCookie = cookieOf(reg);
  ok(reg.status === 201 && reg.data?.needsVerification === true, 'регистрация без истории → 201 + needsVerification', `got ${reg.status}`);
  await verifyFromEmail('fresh@nova-test.ru');
  const freshProfile = await api('GET', '/api/me/profile', { cookie: freshCookie });
  ok(freshProfile.data?.athlete?.displayName === 'Новый Спортсмен', 'создана связка user + athlete (после верификации)');

  // 1.7 валидация
  const badReg = await api('POST', '/api/auth/register', {
    body: { name: 'X', email: 'not-an-email', password: '123' },
  });
  ok(badReg.status === 400 && badReg.data?.error?.code === 'VALIDATION_ERROR', 'некорректная регистрация → 400');

  console.log('\n=== STAGE 5 — кабинет: заявки, профиль, результаты ===');

  // 2.1 без сессии → 401
  const anon = await api('GET', '/api/me/applications');
  ok(anon.status === 401, 'GET /api/me/* без сессии → 401', `got ${anon.status}`);

  // 2.2 демо-спортсмен: заявки + результаты из протокола
  const login = await api('POST', '/api/auth/login', {
    body: { email: 'athlete@nova-anglers.ru', password: 'NovaAthlete2026!' },
  });
  const athleteCookie = cookieOf(login);
  ok(login.status === 200, 'вход демо-спортсмена');

  const athleteApps = await api('GET', '/api/me/applications', { cookie: athleteCookie });
  ok(
    (athleteApps.data?.applications || []).length === 2,
    'демо-спортсмен видит 2 заявки (claiming через сид)',
    `got ${(athleteApps.data?.applications || []).length}`
  );
  const app0 = (athleteApps.data?.applications || [])[0] || {};
  ok(
    Array.isArray(app0.history) && app0.history.length >= 1,
    'заявки содержат хронологию статусов'
  );

  const results = await api('GET', '/api/me/results', { cookie: athleteCookie });
  ok(results.data?.totalPoints === 720, 'рейтинг: 720 очков из протокола NOVA CUP — Дон', `got ${results.data?.totalPoints}`);
  ok(
    (results.data?.items || [])[0]?.competition?.slug === 'nova-don-winter',
    'результат сопоставлен с турниром (ФИО без учёта порядка слов)'
  );

  // 2.3 редактирование профиля
  const patch = await api('PATCH', '/api/me/profile', {
    cookie: freshCookie,
    body: { city: 'Таганрог', phone: '+7 (999) 123-45-67', club: 'Клуб «Тест»', birthDate: '1996-05-15' },
  });
  ok(patch.status === 200 && patch.data?.athlete?.city === 'Таганрог', 'PATCH профиля сохраняет поля');
  const patchAgain = await api('GET', '/api/me/profile', { cookie: freshCookie });
  ok(patchAgain.data?.athlete?.club === 'Клуб «Тест»' && patchAgain.data?.athlete?.phone === '+7 (999) 123-45-67', 'изменения персистентны');
  const badPatch = await api('PATCH', '/api/me/profile', {
    cookie: freshCookie,
    body: { birthDate: '2030-01-01' },
  });
  ok(badPatch.status === 400, 'некорректная дата рождения → 400');

  // 2.4 заявка авторизованного спортсмена сразу привязывается к аккаунту
  const loggedInApp = await api('POST', '/api/applications', {
    cookie: freshCookie,
    body: {
      competitionId: 'bereg-rossii-1',
      entryType: 'athlete',
      participant: {
        lastname: 'Спортсменов',
        firstname: 'Новый',
        email: 'fresh@nova-test.ru',
        phone: '+7 (999) 123-45-67',
        region: 'Ростовская обл.',
        city: 'Таганрог',
        birthdate: '1996-05-15',
      },
    },
  });
  ok(loggedInApp.status === 201, 'заявка авторизованным → 201', `got ${loggedInApp.status} ${JSON.stringify(loggedInApp.data)}`);
  const appsAfter = await api('GET', '/api/me/applications', { cookie: freshCookie });
  ok(
    (appsAfter.data?.applications || []).some((a: any) => a.applicationNumber === loggedInApp.data?.application?.applicationNumber),
    'новая заявка сразу в кабинете (userId проставлен)'
  );

  console.log('\n=== STAGE 5 — документы ===');

  async function upload(cookie: string, f: { type?: string; expires?: string; name?: string; buf?: Buffer; mime?: string }) {
    const fd = new FormData();
    fd.append('type', f.type || 'medical');
    if (f.expires) fd.append('expiresAt', f.expires);
    fd.append('file', new File([f.buf || PDF], f.name || 'doc.pdf', { type: f.mime || 'application/pdf' }));
    return api('POST', '/api/me/documents', { cookie, form: fd });
  }

  // 3.1 успешная загрузка
  let up = await upload(freshCookie, { type: 'medical', expires: '2027-06-01' });
  ok(up.status === 201 && up.data?.document?.status === 'pending', 'загрузка документа → 201 pending', `got ${up.status} ${JSON.stringify(up.data)}`);
  const docId = up.data?.document?.id;

  // 3.2 отклонения
  const tooBig = await upload(freshCookie, { buf: Buffer.alloc(10 * 1024 * 1024 + 1) });
  ok(tooBig.status === 413, 'файл > 10 МБ → 413', `got ${tooBig.status}`);
  const wrongType = await upload(freshCookie, { name: 'virus.exe', mime: 'application/x-msdownload', buf: Buffer.from('MZ') });
  ok(wrongType.status === 415, 'недопустимый формат → 415', `got ${wrongType.status}`);
  const wrongField = await upload(freshCookie, { type: 'diploma' });
  ok(wrongField.status === 400, 'неизвестный тип документа → 400');
  const pastExp = await upload(freshCookie, { expires: '2020-01-01' });
  ok(pastExp.status === 400, 'expiresAt в прошлом → 400');

  // 3.3 доступ к файлу
  const ownFile = await api('GET', `/api/files/${docId}`, { cookie: freshCookie });
  ok(ownFile.status === 200, 'владелец скачивает файл', `got ${ownFile.status}`);
  const otherFile = await api('GET', `/api/files/${docId}`, { cookie: athleteCookie });
  ok(otherFile.status === 404, 'чужой документ → 404 (не раскрываем существование)', `got ${otherFile.status}`);
  const anonFile = await api('GET', `/api/files/${docId}`);
  ok(anonFile.status === 401, 'файл без сессии → 401');

  // 3.5 САМОАУДИТ (1.1): magic bytes — Content-Type/расширению клиента не верим
  const fakePng = await upload(freshCookie, {
    name: 'fake.png',
    mime: 'image/png',
    buf: Buffer.from('<html><script>alert(1)</script></html>'),
  });
  ok(fakePng.status === 415, 'HTML-тело с именем fake.png → 415 (magic bytes)', `got ${fakePng.status}`);
  const fakePdf = await upload(freshCookie, {
    name: 'x.pdf',
    mime: 'application/pdf',
    buf: Buffer.from('это точно не pdf, просто текст'),
  });
  ok(fakePdf.status === 415, 'текстовое тело с именем x.pdf → 415 (magic bytes)', `got ${fakePdf.status}`);

  // 3.6 САМОАУДИТ (1.4/2.4): заголовки отдачи файла
  const raw = await fetch(`${BASE}/api/files/${docId}`, { headers: { Cookie: freshCookie } });
  const rawCt = raw.headers.get('content-type') || '';
  const rawCd = raw.headers.get('content-disposition') || '';
  ok(raw.status === 200 && rawCt.startsWith('application/pdf'), 'Content-Type — из белого списка (pdf)', `got ${rawCt}`);
  ok(rawCd.startsWith('inline'), 'валидный pdf → inline (превью)', `got ${rawCd}`);
  ok(raw.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  ok((raw.headers.get('cache-control') || '').includes('no-store'), 'Cache-Control: no-store');

  // 3.4 admin-проверка документов
  const adminLogin = await api('POST', '/api/auth/login', {
    body: { email: 'admin@nova-anglers.ru', password: 'NovaAdmin2026!' },
  });
  const adminCookie = cookieOf(adminLogin);
  const adminList = await api('GET', '/api/admin/documents?status=pending', { cookie: adminCookie });
  ok(adminList.status === 200, 'admin видит список pending-документов');
  ok(
    (adminList.data?.documents || []).some((d: any) => d.id === docId),
    'загруженный документ в очереди проверки',
    `got ${(adminList.data?.documents || []).length}`
  );

  // viewer не меняет статусы
  const viewerLogin = await api('POST', '/api/auth/login', {
    body: { email: 'viewer@nova-anglers.ru', password: 'NovaViewer2026!' },
  });
  const viewerCookie = cookieOf(viewerLogin);
  const viewerPatch = await api('PATCH', `/api/admin/documents/${docId}`, {
    cookie: viewerCookie,
    body: { status: 'approved' },
  });
  ok(viewerPatch.status === 403, 'viewer не может менять статус документа → 403', `got ${viewerPatch.status}`);

  // reject без причины → 400
  const badReject = await api('PATCH', `/api/admin/documents/${docId}`, {
    cookie: adminCookie,
    body: { status: 'rejected', rejectReason: '' },
  });
  ok(badReject.status === 400, 'отклонение без причины → 400');

  // reject с причиной → спортсмен видит причину
  const reject = await api('PATCH', `/api/admin/documents/${docId}`, {
    cookie: adminCookie,
    body: { status: 'rejected', rejectReason: 'Нечитаемый скан' },
  });
  ok(reject.status === 200, 'отклонение с причиной → 200');
  const afterReject = await api('GET', '/api/me/documents', { cookie: freshCookie });
  const rejDoc = (afterReject.data?.documents || []).find((d: any) => d.id === docId);
  ok(rejDoc?.status === 'rejected' && rejDoc?.rejectReason === 'Нечитаемый скан', 'спортсмен видит причину отклонения');

  // 3.5 повторная загрузка + approve → approved нельзя удалить
  up = await upload(freshCookie, { type: 'medical', expires: '2027-08-01' });
  const docId2 = up.data?.document?.id;
  const approve = await api('PATCH', `/api/admin/documents/${docId2}`, {
    cookie: adminCookie,
    body: { status: 'approved' },
  });
  ok(approve.status === 200, 'одобрение документа → 200');
  const delApproved = await api('DELETE', `/api/me/documents/${docId2}`, { cookie: freshCookie });
  ok(delApproved.status === 403, 'принятый документ нельзя удалить → 403', `got ${delApproved.status}`);

  // 3.6 удаление своего pending-документа
  up = await upload(freshCookie, { type: 'passport' });
  const docId3 = up.data?.document?.id;
  const delOwn = await api('DELETE', `/api/me/documents/${docId3}`, { cookie: freshCookie });
  ok(delOwn.status === 200, 'свой pending-документ удаляется');
  const delGone = await api('GET', `/api/files/${docId3}`, { cookie: freshCookie });
  ok(delGone.status === 404, 'файл удалён из хранилища');

  // 3.8 САМОАУДИТ (2.3): rate limit на выдачу файлов (90/мин на IP).
  // Стоит В КОНЦЕ секции: burst исчерпывает окно 'files:<ip>' на 60 с,
  // поэтому все прочие проверки /api/files должны быть выполнены ДО него.
  const burst = await Promise.all(
    Array.from({ length: 100 }, () => api('GET', `/api/files/${docId2}`, { cookie: freshCookie }))
  );
  const burstCodes = [...new Set(burst.map((r) => r.status))].sort().join(',');
  ok(burst.some((r) => r.status === 429), '100 запросов/мин к /api/files → часть 429', `codes: ${burstCodes}`);

  // 3.7 спортсмен не имеет доступа к admin-эндпоинтам
  const athleteAdminTry = await api('GET', '/api/admin/documents', { cookie: freshCookie });
  ok(athleteAdminTry.status === 403, 'спортсмен не видит очередь проверки → 403');

  console.log('\n=== STAGE 5 — заявка с чужим e-mail не привязывается ===');
  // заявка с ЧУЖИМ e-mail от авторизованного — не получает userId
  const otherEmailApp = await api('POST', '/api/applications', {
    cookie: freshCookie,
    body: {
      competitionId: 'nova-don-summer',
      entryType: 'team',
      participant: {
        name: 'Экипаж Тест-Чужой',
        roster: ['Один Первый', 'Два Второй'],
        email: 'somebody-else@mail.ru',
        phone: '+7 (900) 111-22-33',
        region: 'Ростовская обл.',
        city: 'Таганрог',
      },
    },
  });
  const guestApp =
    otherEmailApp.status === 201
      ? await db.application.findUnique({ where: { applicationNumber: otherEmailApp.data?.application?.applicationNumber } })
      : null;
  ok(!!guestApp && guestApp.userId === null, 'заявка с чужим e-mail остаётся гостевой (userId = null)', `got ${otherEmailApp.status} userId=${guestApp?.userId}`);

  await db.$disconnect();

  // ------------------------------------------------------------
  console.log(`\n=== ИТОГ: ${pass} ✔ / ${fail} ✘ ===`);
  if (failures.length) {
    console.log('Провалены:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
