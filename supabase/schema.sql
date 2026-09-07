-- ============================================================
-- NOVA ANGLERS ALLIANCE — STAGE 6 · PostgreSQL / Supabase schema
-- ============================================================
-- Этот файл — 1:1 зеркало prisma/schema.prisma (те же таблицы, колонки,
-- типы, индексы, что создаёт `prisma db push`) + второй контур защиты.
--
-- АРХИТЕКТУРА ДОСТУПА (два контура, с Stage 4.1):
--
--   Контур 1 — основной. Авторизация и роли (admin/organizer/viewer)
--   проверяет СЕРВЕРНЫЙ API (Next.js route handlers). Браузер никогда
--   не обращается к БД напрямую; соединение с БД держит только сервер.
--
--   Контур 2 — защита самой базы (RLS). Роли:
--     • nova_app        — роль рантайма (её пароль лежит в DATABASE_URL
--                         на сервере). Единственная роль с доступом к
--                         таблицам. RLS-политики разрешают ей DML.
--     • anon / authenticated — роли PostgREST/Supabase (утёкший публичный
--                         ключ НЕ даёт доступа к данным): политик для них
--                         нет вообще, все привилегии отозваны.
--     • postgres / service_role — владелец/migrations (BYPASSRLS), только
--                         для схемы и администрирования.
--   Публичные данные (соревнования, подтверждённые участники) наружу
--   отдаются ТОЛЬКО через view без персональных данных (PII).
--
--   ПРИМЕЧАНИЕ: колонки в camelCase в кавычках — так их создаёт
--   `prisma db push`; не переименовывайте, иначе Prisma и SQL разойдутся.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. TABLES (идентично prisma db push)
-- ============================================================

-- ---------- auth: аккаунты staff и спортсменов + сессии -----------
create table if not exists users (
  id            text primary key,                    -- cuid, генерирует Prisma
  email         text not null unique,
  "passwordHash" text not null,                      -- scrypt:salt:hash
  name          text not null,
  role          text not null default 'athlete',     -- admin|organizer|viewer|athlete (Stage 5)
  "emailVerified" boolean not null default false,    -- Stage 6: клейм только после подтверждения
  "notificationsEnabled" boolean not null default true, -- Stage 6: unsubscribe
  "createdAt"   timestamptz(3) not null default now(),
  "updatedAt"   timestamptz(3) not null
);

create table if not exists sessions (
  id         text primary key,                       -- opaque-токен из httpOnly cookie
  "userId"   text not null references users(id) on delete restrict on update cascade,
  "userAgent" text,
  "createdAt" timestamptz(3) not null default now(),
  "expiresAt" timestamptz(3) not null
);
create index if not exists sessions_user_idx on sessions("userId");

create table if not exists organizer_assignments (
  id             text primary key,
  "userId"       text not null references users(id) on delete restrict on update cascade,
  "competitionId" text not null,
  "createdAt"    timestamptz(3) not null default now()
);
create unique index if not exists organizer_assignments_user_competition_key
  on organizer_assignments("userId", "competitionId");

-- ---------- competitions -------------------------------------
create table if not exists competitions (
  id                    text primary key,
  slug                  text not null unique,
  name                  text not null,
  "shortName"           text not null default '',
  discipline            text not null,
  "disciplineLabel"     text not null default '',
  "entryType"           text not null default 'both',
  description           text not null default '',
  location              text not null default '',
  region                text not null default '',
  "startDate"           timestamptz(3) not null,
  "endDate"             timestamptz(3) not null,
  "dateLabel"           text not null default '',
  "registrationOpenAt"  timestamptz(3),
  "registrationCloseAt" timestamptz(3),
  "maxEntries"          integer not null default 0,     -- 0 = без лимита
  status                text not null default 'draft',
  format                text not null default '',
  "prizeFund"           text not null default '',
  days                  integer not null default 1,
  "pointsMultiplier"    text not null default '×1.0',
  organizer             text not null default 'NOVA Anglers Alliance',
  contact               text not null default '',
  content               text not null default '{}',     -- JSON-блоб страницы турнира
  "entryFee"            integer not null default 0,     -- стартовый взнос в копейках (Stage 6)
  "createdAt"           timestamptz(3) not null default now(),
  "updatedAt"           timestamptz(3) not null
);

alter table organizer_assignments
  add constraint organizer_assignments_competition_fk
  foreign key ("competitionId") references competitions(id)
  on delete cascade on update cascade;

-- ---------- athletes / teams ---------------------------------
create table if not exists athletes (
  id              text primary key,
  "firstName"     text not null default '',
  "lastName"      text not null default '',
  "middleName"    text,
  "displayName"   text not null,
  "birthDate"     timestamptz(3),
  phone           text,
  email           text,
  region          text not null default '',
  city            text not null default '',
  club            text,
  "sportsCategory" text not null default '',
  "createdAt"     timestamptz(3) not null default now(),
  "updatedAt"     timestamptz(3) not null,
  "userId"        text                             -- STAGE 5: Profile Claiming (1:1)
);
create index if not exists athletes_email_idx on athletes(email);
create index if not exists athletes_name_idx on athletes("lastName", "firstName");
create unique index if not exists athletes_userId_key on athletes("userId");
alter table athletes
  add constraint athletes_user_fk
  foreign key ("userId") references users(id)
  on delete set null on update cascade;

create table if not exists teams (
  id         text primary key,
  name       text not null,
  region     text not null default '',
  club       text,
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null
);

create table if not exists team_members (
  id         text primary key,
  "teamId"   text not null references teams(id) on delete cascade on update cascade,
  "athleteId" text not null references athletes(id) on delete cascade on update cascade,
  role       text not null default 'member',
  "createdAt" timestamptz(3) not null default now()
);
create unique index if not exists team_members_team_athlete_key
  on team_members("teamId", "athleteId");

-- ---------- applications -------------------------------------
create table if not exists applications (
  id                 text primary key,
  "applicationNumber" text not null unique,           -- NOVA-2026-000001 (сервер)
  "competitionId"    text not null references competitions(id) on delete restrict on update cascade,
  "entryType"        text not null,                    -- athlete | team
  status             text not null default 'submitted',-- submitted|under_review|approved|needs_changes|rejected|withdrawn
  "contactEmail"     text not null,                    -- normalized (lowercase)
  "contactPhone"     text not null default '',
  "accessToken"      text not null,                    -- доступ к экрану подтверждения
  "teamId"           text references teams(id) on delete set null on update cascade,
  "userId"           text references users(id) on delete set null on update cascade, -- STAGE 5: аккаунт спортсмена
  "rawPayload"       text not null default '{}',
  notes              text not null default '',
  source             text not null default 'web',      -- web | seed
  "submittedAt"      timestamptz(3) not null default now(),
  "updatedAt"        timestamptz(3) not null,
  "reviewedAt"       timestamptz(3),
  "reviewedBy"       text references users(id) on delete set null on update cascade,
  comment            text
);
create index if not exists applications_comp_status_idx on applications("competitionId", status);
create index if not exists applications_email_idx on applications("contactEmail");
create index if not exists applications_user_idx on applications("userId");

-- ГАРАНТИЯ ОТ ДУБЛЕЙ НА УРОВНЕ БД (Этап 4.1):
-- одна АКТИВНАЯ заявка на (соревнование × контактный e-mail).
-- rejected/withdrawn освобождают e-mail для повторной подачи.
-- Prisma DSL не умеет partial indexes — поэтому индекс живёт здесь
-- и в prisma/apply-indexes.ts (для локального запуска без SQL-консоли).
create unique index if not exists applications_active_contact_uniq
  on applications ("competitionId", "contactEmail")
  where status not in ('rejected', 'withdrawn');

create table if not exists application_participants (
  id             text primary key,
  "applicationId" text not null references applications(id) on delete cascade on update cascade,
  "athleteId"    text not null references athletes(id) on delete restrict on update cascade,
  role           text not null default 'member',      -- solo | captain | member
  "createdAt"    timestamptz(3) not null default now()
);
create index if not exists application_participants_app_idx on application_participants("applicationId");

create table if not exists application_status_history (
  id             text primary key,
  "applicationId" text not null references applications(id) on delete cascade on update cascade,
  "oldStatus"    text,
  "newStatus"    text not null,
  "changedById"  text references users(id) on delete set null on update cascade,
  comment        text,
  "createdAt"    timestamptz(3) not null default now()
);
create index if not exists application_status_history_app_idx on application_status_history("applicationId");

-- ---------- документы заявки (вложения формы, Stage 4) ------------
create table if not exists application_documents (
  id             text primary key,
  "applicationId" text not null references applications(id) on delete cascade on update cascade,
  "filePath"     text not null,                       -- путь в Storage, не сам файл
  "fileName"     text not null,
  "documentType" text not null default '',
  "uploadedAt"   timestamptz(3) not null default now()
);

-- ---------- документы спортсмена (личный кабинет, Stage 5) --------
-- Файлы — в объектном хранилище (Supabase Storage, приватный бакет);
-- здесь только метаданные. Наружу файл отдаёт только серверный API
-- (/api/files/:id — владелец или staff), публичного URL у файла нет.
-- type: medical | federation_id | passport
-- status: pending | approved | rejected | expired
create table if not exists documents (
  id             text primary key,
  "userId"       text not null references users(id) on delete cascade on update cascade,
  type           text not null,
  "fileUrl"      text not null,                       -- ключ хранения (documents/<uuid>.<ext>)
  "fileName"     text not null default '',
  "fileSize"     integer not null default 0,
  "mimeType"     text not null default '',
  status         text not null default 'pending',
  "rejectReason" text,
  "reviewedAt"   timestamptz(3),
  "reviewedById" text,
  "uploadedAt"   timestamptz(3) not null default now(),
  "expiresAt"    timestamptz(3)
);
create index if not exists documents_user_idx on documents("userId");
create index if not exists documents_status_idx on documents(status);
alter table documents
  add constraint documents_reviewer_fk
  foreign key ("reviewedById") references users(id)
  on delete set null on update cascade;

-- ---------- счётчик номеров заявок ---------------------------
create table if not exists counters (
  key   text primary key,
  value integer not null default 0
);

-- ---------- e-mail верификация (Stage 6 §1.2) -------------------
-- В БД хранится SHA-256 ХЕШ токена (колонка token); сырой токен уходит
-- только в ссылку письма. Клейм гостевых заявок выполняется строго
-- после подтверждения адреса (закрывает п. 3.3 аудита Этапа 5).
create table if not exists email_verifications (
  id          text primary key,
  "userId"    text not null references users(id) on delete cascade on update cascade,
  token       text not null unique,                    -- sha256(raw)
  "expiresAt" timestamptz(3) not null,
  "verifiedAt" timestamptz(3),
  "createdAt" timestamptz(3) not null default now()
);
create index if not exists email_verifications_user_idx on email_verifications("userId");

-- ---------- платежи (Stage 6 §2.2) ------------------------------
-- 1:1 с заявкой (applicationId unique), сумма в копейках.
-- Провайдер — CloudPayments (src/lib/payments.ts), webhook защищён HMAC.
create table if not exists payments (
  id             text primary key,
  "applicationId" text not null unique references applications(id) on delete cascade on update cascade,
  amount         integer not null,                     -- копейки
  currency       text not null default 'RUB',
  status         text not null default 'pending',      -- pending|paid|failed|refunded
  "providerId"   text,
  "paidAt"       timestamptz(3),
  "refundReason" text,
  "createdAt"    timestamptz(3) not null default now()
);
create index if not exists payments_status_idx on payments(status);

-- ---------- журнал писем (Stage 6 §1.1/§1.4) --------------------
-- idempotencyKey (unique) защищает от дублей при retry; счётчики
-- по этой таблице — это rate limits (3/мин на пользователя, 100/час).
create table if not exists email_log (
  id              text primary key,
  "idempotencyKey" text not null unique,
  "userId"        text references users(id) on delete set null on update cascade,
  "to"            text not null,
  template        text not null,
  subject         text not null,
  body            text not null default '',
  status          text not null default 'pending',     -- pending|sent|failed|skipped
  error           text,
  "createdAt"     timestamptz(3) not null default now()
);
create index if not exists email_log_user_created_idx on email_log("userId", "createdAt");
create index if not exists email_log_created_idx on email_log("createdAt");

-- ============================================================
-- 2. RLS — ВТОРОЙ КОНТУР ЗАЩИТЫ
-- ============================================================
-- Политик для anon/authenticated НЕТ: ни чтения, ни записи.
-- nova_app — единственная прикладная роль, политики для неё полные:
-- проверку ролей и закрепления организаторов делает серверный API
-- (контур 1), поэтому на уровне строк ограничений не требуется.

alter table users                      enable row level security;
alter table sessions                   enable row level security;
alter table organizer_assignments      enable row level security;
alter table competitions               enable row level security;
alter table athletes                   enable row level security;
alter table teams                      enable row level security;
alter table team_members               enable row level security;
alter table applications               enable row level security;
alter table application_participants   enable row level security;
alter table application_status_history enable row level security;
alter table application_documents      enable row level security;
alter table documents                  enable row level security;
alter table counters                   enable row level security;
alter table email_verifications        enable row level security;
alter table payments                   enable row level security;
alter table email_log                  enable row level security;

-- ---------- nova_app: полный DML (доверенный серверный рантайм) ----
do $$
declare t text;
begin
  foreach t in array array[
    'users','sessions','organizer_assignments','competitions',
    'athletes','teams','team_members','applications',
    'application_participants','application_status_history',
    'application_documents','documents','counters',
    'email_verifications','payments','email_log'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_nova_app_all', t);
    execute format(
      'create policy %I on %I for all to nova_app using (true) with check (true)',
      t || '_nova_app_all', t
    );
    execute format('revoke all on %I from public', t);
  end loop;
end $$;

-- ---------- жёсткая блокировка anon / authenticated ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ============================================================
-- 3. ПУБЛИЧНЫЕ VIEW (единственная публичная поверхность)
-- ============================================================
-- Только безопасные колонки и только подтверждённые участники.
-- PII (телефон, e-mail, дата рождения, комментарии, raw-заявка) — недоступна.
-- security_invoker = false (definer): view выполняется от владельца,
-- т.к. у anon политик на базовых таблицах нет. Поверхность доступа
-- ограничена самим определением view.

drop view if exists public_competition_participants;
create view public_competition_participants with (security_barrier = true) as
select
  c.slug                                   as "competitionId",
  a."applicationNumber",
  ap.role,
  ath."displayName"                        as name,
  coalesce(t.name, ath.club)               as "teamName",
  ath.region,
  a.status
from applications a
join application_participants ap on ap."applicationId" = a.id
join athletes ath                on ath.id = ap."athleteId"
left join teams t                on t.id = a."teamId"
join competitions c              on c.id = a."competitionId"
where a.status = 'approved';

drop view if exists public_competitions;
create view public_competitions with (security_barrier = true) as
select
  slug, name, "shortName", "disciplineLabel", "entryType",
  description, location, region, "startDate", "endDate",
  "dateLabel", "maxEntries", status, format, "prizeFund", "entryFee",
  days, "pointsMultiplier", organizer
from competitions;

grant usage on schema public to anon, authenticated;
grant select on public_competitions, public_competition_participants to anon, authenticated;

-- ============================================================
-- 4. РОЛЬ РАНТАЙМА nova_app (выполнить один раз)
-- ============================================================
-- В Supabase: SQL Editor → создать роль, затем использовать её пароль
-- в DATABASE_URL серверного API (НЕ postgres и НЕ service_role).
--
--   create role nova_app login password 'СГЕНЕРИРУЙТЕ-СВОЙ-ПАРОЛЬ';
--   grant usage on schema public to nova_app;
--   grant select, insert, update, delete on all tables in schema public to nova_app;
--   alter default privileges in schema public
--     grant select, insert, update, delete on tables to nova_app;
--
-- STAGE 5 (файлы документов): в Supabase дополнительно создать ПРИВАТНЫЙ
-- бакет Storage (например «documents») и ключи SUPABASE_URL /
-- SUPABASE_SERVICE_ROLE_KEY в .env сервера — см. SUPABASE_SETUP.md.
--
-- Миграции (`prisma db push`) выполняются от владельца схемы
-- (postgres), у nova_app прав DDL нет.

-- ============================================================
-- 5. ПРОВЕРКА (выполнить вручную)
-- ============================================================
-- set role anon;
--   select * from competitions;                      -- ERROR (RLS, политик нет)
--   select * from applications;                      -- ERROR
--   select * from public_competitions;               -- OK, без PII
--   select * from public_competition_participants;   -- OK, только approved
-- reset role;
-- set role nova_app;
--   select count(*) from applications;               -- OK (через серверный API)
-- reset role;
