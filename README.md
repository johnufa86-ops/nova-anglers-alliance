# NOVA ANGLERS ALLIANCE — Этап 5
## Личный кабинет спортсмена («цифровая спортивная книжка»)

Статический сайт Альянса сохранён как есть (дизайн, структура, мастер
регистрации). Заявки уходят **в PostgreSQL через безопасный серверный API**,
организатор работает в **кабинете с авторизацией и ролями**,
спортсмен — в **личном кабинете** (Этап 5), поверх — **уведомления,
оплата взносов и рейтинг** (Этап 6).

**Этап 6 — что добавлено (§1–§2 по ТЗ, §3 — контур до уточнения ТЗ):**

- **E-mail верификация при регистрации (§1.2)**: токен (randomUUID+байты)
  хранится только как SHA-256 хеш в `email_verifications`; письмо со ссылкой
  `/api/auth/verify?token=...` (24 ч); `user.emailVerified=true`.
  **Profile Claiming выполняется ТОЛЬКО после подтверждения адреса** —
  закрывает п. 3.3 аудита Этапа 5. Повторная отправка: POST /api/auth/verify
  (3/мин). Повторный клик по ссылке идемпотентен.
- **E-mail уведомления (§1.3)**: заявка создана / статус изменён / документ
  проверен / оплата получена. Провайдер — Resend REST (`SMTP_API_KEY`,
  server-only), драйвер `console` для dev (письмо в `email_log` + stdout).
  Шаблоны Dark Premium NOVA, inline CSS, адаптивные.
- **Защита от спама (§1.4)**: rate limit 3/мин на пользователя и 100/час
  глобально (счётчики по `email_log` — переживают рестарт); idempotencyKey
  на каждое событие (unique) — retry не дублирует письма; unsubscribe-ссылка
  в каждом письме (`/api/unsubscribe?token=<userId>.<HMAC>`), флаг
  `notificationsEnabled` respected во всех шаблонах.
- **Оплата стартовых взносов (§2)**: модель `Payment` (сумма в копейках,
  1:1 с заявкой), провайдер абстрагирован (`PAYMENTS_DRIVER`):
  `cloudpayments` (REST `/v1/orders/create`, ключи в server-only env) или
  `mock` (dev: локальная страница оплаты, в проде запрещён). Webhook
  `POST /api/payments/webhook` — HMAC-SHA256 провайдера над сырым телом
  (timingSafeEqual), идемпотентная обработка Pay/Fail/Refund, контроль
  суммы события, чек спортсмену.
- **Рейтинг (§3 — КОНТУР)**: публичный `GET /api/rating` (без PII: имя,
  регион, очки, турниры) из протоколов approved-заявок завершённых турниров;
  страница `/rating.html` берёт реальные данные с fallback на демо.
  ⚠ Раздел §3 «РЕЙТИНГ» в полученном ТЗ отсутствует (текст обрывается после
  модели Payment) — реализован минимальный контур, расширяемый после
  уточнения требований.

**Этап 5 — что добавлено:**

- **Регистрация спортсменов + Profile Claiming** — при регистрации сервер
  ищет `athletes` и `applications` с тем же contact e-mail и автоматически
  привязывает их к новому `user_id` («гостевые» заявки Этапа 4 попадают в
  кабинет). E-mail уже занят другим аккаунтом → **409 Conflict**;
  не найден — создаётся связка `user + athlete`. Всё в одной транзакции.
- **Кабинет спортсмена `/cabinet`** — обзор (профиль + KPI), история заявок
  с хронологией статусов и комментариями организатора, загрузка документов
  (drag-n-drop, до 10 МБ, PDF/JPG/PNG/WEBP), результаты и очки рейтинга NOVA
  из протоколов турниров, редактирование профиля.
- **Документы спортсмена** — метаданные в таблице `documents`, файлы — в
  хранилище (локальный драйвер в деве, **Supabase Storage** в проде —
  переключается одной переменной `STORAGE_DRIVER`). Публичного URL у файла
  нет: отдача только через авторизованный `/api/files/:id` (владелец или
  staff). Статусы: `pending → approved / rejected (с причиной) / expired`
  (медсправки истекают по `expiresAt` автоматически).
- **Проверка документов организатором** — блок «Документы спортсменов» в
  дашборде `/admin`: очередь pending, открытие файла, принять/отклонить
  (причина обязательна, спортсмен видит её в кабинете).
- **Связность** — заявка, поданная авторизованным спортсменом со своим
  e-mail, сразу получает `userId`; заявка с чужим e-mail остаётся гостевой.

**Этап 4.1** — закрывает замечания независимого аудита Этапа 4:

| # | Замечание аудита | Решение в 4.1 |
|---|---|---|
| 1 | `.env` с паролем БД попал в архив | архив собирается **без `.env`** (только `.env.example`); пароли демо-аккаунтов задаются до сида |
| 2 | фактический runtime был SQLite | Prisma переведена на **PostgreSQL** (`provider = "postgresql"`), все даты — `timestamptz(3)`; билд протестирован на реальном PostgreSQL 17 |
| 3 | race condition: проверка лимита мест до транзакции | проверка места теперь **внутри транзакции**, конкурентность устраняет `SELECT … FOR UPDATE` на строке соревнования; тест 5 одновременных заявок на 2 места → ровно 2 успешных |
| 4 | дубль заявки не закреплён на уровне БД | **partial unique index** `(competitionId, contactEmail) WHERE status NOT IN ('rejected','withdrawn')` + обработка `P2002 → 409`; тест 6 одновременных заявок с одним e-mail → ровно 1 успешная |
| 5 | RLS на `request.jwt.claims` несовместим с серверным подключением | архитектура «двух контуров»: авторизация — в серверном API; RLS блокирует всё, кроме выделенной роли **`nova_app`**; публичные данные — только через view без PII |
| 6 | `typescript.ignoreBuildErrors: true` | удалён; `tsc --noEmit` проходит чисто |

```text
БЫЛО:  register.js → applications.js → localStorage

СТАЛО: register.js → applications.js → API (/api/**) → SERVER (Next.js) → PostgreSQL (Supabase-ready)
                       кабинет организатора → admin.js → API → SERVER → PostgreSQL
                       кабинет спортсмена   → cabinet.js → API → SERVER → PostgreSQL + Storage
```

---

## 1. Быстрый старт

Требуется [Bun](https://bun.sh) 1.x (или Node 20+ + npm) и **PostgreSQL 14+**
(локальный или Supabase).

```bash
bun install                 # зависимости

cp .env.example .env        # укажите DATABASE_URL (и пароли демо-аккаунтов)

bun run db:push             # создать таблицы (Prisma → PostgreSQL)
bun prisma/apply-indexes.ts # частичный уникальный индекс (защита от дублей)
bun prisma/seed.ts          # пользователи, календарь сезона, демо-заявки

bun run dev                 # http://localhost:3000
```

Для Supabase — пошаговая инструкция в **SUPABASE_SETUP.md**
(структура `supabase/schema.sql` идентична результату `prisma db push`,
плюс RLS и публичные view).

### Первичные учётные записи (создаёт seed, пароли задаются в .env до сида)

| Роль      | E-mail (по умолчанию)     | Пароль (по умолчанию)  | Права |
|-----------|---------------------------|------------------------|-------|
| admin     | `admin@nova-anglers.ru`     | `NovaAdmin2026!`       | полный доступ |
| organizer | `organizer@nova-anglers.ru` | `NovaOrganizer2026!`   | заявки/экспорт назначенных соревнований |
| viewer    | `viewer@nova-anglers.ru`    | `NovaViewer2026!`      | только просмотр |
| **athlete** (демо, Stage 5) | `athlete@nova-anglers.ru` | `NovaAthlete2026!` | личный кабинет спортсмена: 2 заявки, документы, 720 очков рейтинга |

⚠ **Смените пароли в `.env` перед сидом в реальном окружении.**
На странице входа пароли не публикуются. Спортсмены регистрируются
самостоятельно на `/cabinet` — регистрация связывает их гостевые заявки
автоматически (Profile Claiming).

### Адреса

| Раздел | URL |
|---|---|
| Публичный сайт | `/` |
| Соревнование | `/competition.html?id=nova-cup-volga` |
| Регистрация на турнир | `/register.html?id=nova-cup-volga` |
| **Кабинет спортсмена** | **`/cabinet`** (вход/регистрация) |
| Заявки спортсмена | `/cabinet/applications` |
| Документы спортсмена | `/cabinet/documents` |
| Результаты и рейтинг | `/cabinet/results` |
| Профиль спортсмена | `/cabinet/profile` |
| Кабинет организатора | `/admin` (алиас `/organizer`) |
| Список заявок | `/admin/applications` |
| Карточка заявки | `/admin/application?id=…` |
| Соревнование в кабинете | `/admin/competition/nova-cup-volga` |

---

## 2. Переменные окружения

| Переменная | Обязательна | Назначение |
|---|---|---|
| `DATABASE_URL` | да | строка подключения Prisma к PostgreSQL (локальный/Supabase Session Pooler/прямой) |
| `NOVA_ADMIN_EMAIL` / `NOVA_ADMIN_PASSWORD` | до сида | учётка администратора |
| `NOVA_ORGANIZER_EMAIL` / `NOVA_ORGANIZER_PASSWORD` | до сида | учётка организатора |
| `NOVA_VIEWER_EMAIL` / `NOVA_VIEWER_PASSWORD` | до сида | учётка наблюдателя |
| `NOVA_ATHLETE_EMAIL` / `NOVA_ATHLETE_PASSWORD` | до сида | демо-спортсмен (личный кабинет) |
| `STORAGE_DRIVER` | нет (по умолчанию `local`) | `local` — файлы в `storage/documents/`; `supabase` — Supabase Storage |
| `STORAGE_DIR` | нет | каталог локального драйвера (по умолчанию `<project>/storage/documents`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | при `STORAGE_DRIVER=supabase` | доступ к Supabase Storage (приватный бакет) |
| `NOVA_DOCUMENTS_BUCKET` | нет (по умолчанию `documents`) | имя приватного бакета Storage |

Никаких других секретов приложению не нужно; во фронтенд секреты не
попадают. **Файл `.env` никогда не публикуется и не кладётся в архивы.**

> Примечание: если платформа предустанавливает свой `DATABASE_URL`
> (например, шаблонный SQLite), `src/lib/db.ts` берёт значение из `.env` —
> схема PostgreSQL имеет приоритет.

---

## 3. Что реализовано (по ТЗ Этапа 4 + доработки 4.1)

- **Подача заявки (§7)** — серверный конвейер: валидация → **одна
  транзакция**: блокировка строки соревнования (`FOR UPDATE`) → окно
  регистрации → лимит мест → дубликат → спортсмен/экипаж + участники +
  заявка + история → серверный номер.
- **Уникальные номера (§3)** — генерирует сервер внутри транзакции
  (таблица-счётчик с атомарным инкрементом + уникальный индекс).
- **Повторные заявки (§8)** — дубликат по `competition + email` отсекается
  трижды: проверка под блокировкой, partial unique index в БД (гарантия
  даже в обход API), баннер «у вас уже есть заявка» на устройстве.
  `rejected`/`withdrawn` освобождают e-mail для повторной подачи.
- **Кабинет организатора (§9–16)** — вход email/пароль, роли
  admin/organizer/viewer, дашборд, реестр с поиском и фильтрами, карточка
  заявки с историей, подтверждение / на проверку / доработка (комментарий
  обязателен) / отклонение (комментарий обязателен), места
  (всего/занято/свободно), экспорт **CSV и XLSX**.
- **Публичный список участников (§17)** — только подтверждённые: имя,
  команда, регион. Телефоны, e-mail, даты рождения, комментарии публично
  недоступны — в API, RLS и view.
- **Защита (§18–19)** — два контура: (1) серверный API: сессии в
  httpOnly-cookie, scrypt-пароли, роли, закрепление соревнований,
  рейт-лимиты; (2) БД: RLS + роль `nova_app` + публичные view
  (`supabase/schema.sql`).
- **Обработка ошибок (§23)** — офлайн, серверная ошибка, закрытая
  регистрация, дубль — понятные сообщения, данные формы не теряются.
- **Заделы (§20)** — `application_documents` под Storage, токен доступа
  к заявке под будущий кабинет спортсмена.

## 4. Статусы заявки

```
submitted → under_review → approved
                ↓               ↓(отзыв решения с комментарием)
         needs_changes     rejected
                ↓
          under_review / rejected
```

Комментарий организатора **обязателен** для `needs_changes` и `rejected`.
Каждый переход пишется в `application_status_history` (автор, время, комментарий).

## 5. Data-слой фронтенда (§21–22)

Страницы никогда не ходят в БД напрямую — только через слои:

| Файл | Назначение |
|---|---|
| `js/api.js` | базовый транспорт, нормализация ошибок (OFFLINE/VALIDATION/…), JSON и FormData |
| `js/competitions.js` | публичные соревнования; демо-данные из `data/data.js` — офлайн-фолбэк |
| `data/applications.js` | `create / getById / listByCompetition / listAll / updateStatus / getStatistics / exportCompetition / listDocuments / reviewDocument` |
| `js/admin.js` | сессия организатора: `me / login / logout / can` |
| `js/admin-ui.js` | каркас кабинета организатора: шапка, роли, тосты, guard |
| `js/cabinet.js` | сессия и данные спортсмена: `me / login / register / logout / profile / applications / results / documents / uploadDocument / deleteDocument` |
| `js/cabinet-ui.js` | каркас кабинета спортсмена: шапка, guard, тосты, форматтеры |

## 6. API

Публичные:
```
GET  /api/competitions                        каталог (публичные поля, реальные счётчики)
GET  /api/competitions/:slug                  карточка турнира
GET  /api/competitions/:slug/participants     подтверждённые участники (имя/команда/регион)
POST /api/applications                        подача заявки (валидация на сервере;
                                              авторизованный спортсмен получает userId при своём e-mail)
GET  /api/applications/lookup?number=&token=  подтверждение по номеру+токену
POST /api/auth/register                       регистрация спортсмена + Profile Claiming (409 при занятом e-mail)
```

Кабинет организатора (сессия):
```
POST   /api/auth/login                        вход (email+password)
POST   /api/auth/logout                       выход
GET    /api/auth/me                           текущий пользователь
GET    /api/admin/overview                    KPI + очереди дашборда
GET    /api/admin/applications                реестр: q, competition, status, type, dateFrom/To, page
GET    /api/admin/applications/:id            карточка заявки + участники + история
PATCH  /api/admin/applications/:id/status     смена статуса {status, comment}
GET    /api/admin/competitions/:slug          места + заявки соревнования
GET    /api/admin/competitions/:slug/export   ?format=csv|xlsx&scope=approved|all
GET    /api/admin/documents?status=pending    очередь проверки документов
PATCH  /api/admin/documents/:id               {status: approved|rejected, rejectReason?}
```

Кабинет спортсмена (сессия, Stage 5):
```
GET    /api/me/profile                        профиль + athlete + сводка (заявки/очки/документы)
PATCH  /api/me/profile                        правка профиля (name/phone/region/city/club/разряд/дата рождения)
GET    /api/me/applications                   история заявок с хронологией и комментариями
GET    /api/me/results                        результаты и очки рейтинга NOVA (сопоставление с протоколами)
GET    /api/me/documents                      свои документы (+ автопометка просроченных)
POST   /api/me/documents                      загрузка (multipart: type, expiresAt?, file ≤10МБ)
DELETE /api/me/documents/:id                  удалить свой pending/rejected/expired (approved защищён)
GET    /api/files/:id                         файл документа (владелец или staff; без публичного URL)
```

Коды ошибок: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
`REGISTRATION_CLOSED`, `DUPLICATE_APPLICATION`, `EMAIL_TAKEN`,
`EMAIL_CLAIMED`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_FILE`, `NOT_FOUND`,
`RATE_LIMITED`.

## 7. Модель данных

`users` (роли admin/organizer/viewer/**athlete**), `sessions`,
`organizer_assignments`, `competitions`, `athletes` (+`userId`, 1:1 с
аккаунтом), `teams`, `team_members`, `applications` (+`userId`),
`application_participants`, `application_status_history`,
`application_documents` (вложения формы), **`documents`** (документы
спортсмена: метаданные; файлы — в Storage), `counters`.

Связная схема: одна заявка → один спортсмен **или** экипаж (команда +
состав через `team_members`), участники заявки — строки
`application_participants` (не JSON), история — отдельная таблица.
Все даты — `timestamptz(3)`.

**Profile Claiming (Этап 5):** регистрация в одной транзакции привязывает
к новому аккаунту записи `athletes` (1:1, unique `userId`) и все
`applications` с тем же contact e-mail. Гостевые заявки попадают в кабинет
без ручной модерации.

## 8. Тесты (PostgreSQL 17)

Автотесты: `scripts/stage5-api-test.ts` (Этап 5),
`scripts/stage41-concurrency-test.ts`,
`scripts/stage41-status-cycle-test.ts` (Этап 4.1)
(`DATABASE_URL=… bun scripts/<файл>`; перед запуском stage5 — свежий сид;
dev-сервер должен быть запущен).

**Этап 5 — 43/43 зелёные:**
- ✅ регистрация с историей: гостевая заявка привязана, роль по умолчанию
  `athlete`, сессия работает;
- ✅ `409 EMAIL_TAKEN` (аккаунт существует) и `409 EMAIL_CLAIMED`
  (запись спортсмена привязана к другому user_id);
- ✅ свежий e-mail → связка user + athlete; валидация полей → 400;
- ✅ кабинет: заявки с хронологией, профиль (правка + персистентность),
  результаты — 720 очков из протокола (ФИО без учёта порядка слов);
- ✅ заявка авторизованного со своим e-mail → сразу в кабинете;
  с чужим e-mail — остаётся гостевой (`userId = null`);
- ✅ документы: 201 pending, >10МБ → 413, неверный формат → 415,
  просроченный срок → 400; владелец качает файл, чужой → 404, без сессии → 401;
- ✅ проверка: admin видит очередь, viewer → 403, отклонение без причины → 400,
  спортсмен видит причину; approved нельзя удалить; pending удаляется с файлом;
- ✅ браузерные E2E: вход/регистрация → дашборд (KPI 2/1/720/1-2), заявки
  с хронологией, загрузка документа через dropzone, approve в `/admin`,
  правка профиля с сохранением, мобильный 390px, ссылка «Войти» на сайте;

**Этап 4.1 (регресс зелёный):**
- ✅ **гонка за последнее место**: `maxEntries=2`, 5 одновременных заявок →
  ровно 2 успешных (201), 3 × `REGISTRATION_CLOSED`, в БД ровно 2 активные;
- ✅ **гонка дублей**: 6 одновременных заявок с одним e-mail → ровно 1
  успешная, 5 × `DUPLICATE_APPLICATION` с номером существующей заявки;
- ✅ номера `NOVA-ГГГГ-NNNNNN` уникальны в БД и соответствуют формату;
- ✅ отклонение без комментария → 400; отклонённая заявка освобождает
  e-mail → повторная подача создаёт новую заявку с новым номером;
- ✅ экспорт CSV (BOM, «;») и XLSX (валидный OOXML) — только organizer/admin;
- ✅ RLS-матрица на живом PostgreSQL: `anon` — отказ на всех таблицах,
  публичные view отдают только безопасные поля подтверждённых участников;
  `nova_app` — полный DML, приложение работает под этой ролью;
- ✅ неавторизованный `/api/admin/**` — 401; `viewer` не меняет статусы — 403;
- ✅ публичные эндпоинты не отдают телефон/e-mail/дату рождения/комментарии;
- ✅ `tsc --noEmit` чистый (сборка без `ignoreBuildErrors`).

## 9. Новые и изменённые файлы (в 5)

**Новые (Этап 5):**
- `src/app/api/auth/register/route.ts` — регистрация + Profile Claiming (транзакция, 409)
- `src/app/api/me/profile|applications|documents|results/route.ts` — API кабинета
- `src/app/api/me/documents/[id]/route.ts` — удаление своего документа
- `src/app/api/files/[id]/route.ts` — авторизованная выдача файлов
- `src/app/api/admin/documents/route.ts`, `[id]/route.ts` — проверка документов
- `src/lib/cabinet.ts`, `src/lib/storage.ts` — домен кабинета + драйверы хранилища
- `public/cabinet*.html` (5 страниц), `js/cabinet.js`, `js/cabinet-ui.js`, CSS `cab-*`
- `scripts/stage5-api-test.ts` — 43 API-проверки

**Изменённые:**
- `prisma/schema.prisma` — `User.role` (+athlete, default), `Athlete.userId` (1:1),
  `Application.userId`, модель `Document`
- `supabase/schema.sql` — зеркало Stage 5 + RLS на `documents`
- `src/app/api/applications/route.ts` — привязка `userId` при подаче авторизованным
- `src/lib/auth.ts` (+роль athlete, `requireAnyUser/requireStaff`), `src/lib/api.ts`
  (+коды 409/413/415), `src/lib/db.ts` (приоритет PostgreSQL-URL из .env)
- `public/js/api.js` — поддержка FormData; `public/data/applications.js` —
  `listDocuments/reviewDocument`; `public/admin.html` — блок документов
- `next.config.ts` — реврайты `/cabinet/*`; шапки страниц — ссылка «Войти» → `/cabinet`
- `prisma/seed.ts` — демо-спортсмен (claimed-профиль, документы)
- `.env.example`, `README.md`, `SUPABASE_SETUP.md`

**История 4.1:**
- `prisma/schema.prisma` — `provider = "postgresql"`, все даты `timestamptz(3)`
- `src/app/api/applications/route.ts` — транзакция с `FOR UPDATE`, лимит
  мест и дубликаты под блокировкой, `P2002 → 409`
- `prisma/apply-indexes.ts` — частичный уникальный индекс от дублей
- `scripts/stage41-concurrency-test.ts`, `scripts/stage41-status-cycle-test.ts`

## 10. Что НЕ входит (следующие этапы)

Оплата взносов, e-mail-уведомления (о статусах заявки и документов),
автоматический пересчёт рейтинга из протоколов, полноценная админка
соревнований, редактирование заявок участником, восстановление пароля.

## 11. Известные ограничения (самоаудит Этапа 5)

- **Profile Claiming без e-mail-верификации (3.3).** Привязка гостевых заявок
  выполняется по факту владения e-mail на момент регистрации. Полноценная
  верификация (confirmation link) требует SMTP-провайдера, которого в проекте
  нет. При подключении почтового сервиса перед `updateMany` в
  `POST /api/auth/register` добавляется проверка `emailVerified`. Смягчение
  сейчас: в заявках нет документов/файлов, чувствительные файлы кабинета
  закрыты проверкой владельца; аналитика злоупотребления — по журналу аудита.
- **Rate limiter в памяти процесса** (`src/lib/api.ts`). Достаточно для одного
  инстанса Node; при горизонтальном масштабировании заменить на Redis/Upstash.
- **E-mail пользователя неизменяем** — смена не предусмотрена by design
  (целостность Profile Claiming); реализация смены потребует той же
  e-mail-верификации и переноса привязок в одной транзакции.
- **Миграции через `prisma db push`** — история миграций и `migrate`-откаты не
  используются; эталон схемы для продакшена — `supabase/schema.sql` (идентичен
  результату `db push` + RLS).
