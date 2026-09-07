# NOVA — настройка Supabase (Этапы 4.1 / 5)

Этот билд работает по схеме из ТЗ (§2): публичный фронтенд → безопасный
серверный API → PostgreSQL (Supabase). Секреты существуют только на сервере.

В Этапе 4.1 схема уже **PostgreSQL-native**: `prisma/schema.prisma` —
`provider = "postgresql"`, все даты `timestamptz(3)`, а
`supabase/schema.sql` — точное зеркало Prisma-схемы + второй контур защиты
(RLS + публичные view).

## Архитектура доступа — два контура

```
Браузер ──✗── никогда не подключается к БД
   │
   ▼
Next.js API (роли admin/organizer/viewer, сессии, рейт-лимиты)
   │  DATABASE_URL → роль nova_app (только DML, без DDL)
   ▼
PostgreSQL / Supabase
   ├── RLS: политики есть ТОЛЬКО для nova_app
   ├── anon / authenticated: привилегий нет, политик нет → доступ запрещён
   └── публичные данные наружу — только через view без PII
```

Контур 1 (авторизация, роли, закрепление организаторов) — серверный API.
Контур 2 (RLS) — защита самой базы: утёкший `anon`-ключ Supabase не даёт
доступа к данным, а публичная выборка ограничена колонками и строками
view. JWT-политики на `request.jwt.claims` сознательно не используются —
серверное подключение Prisma не устанавливает Supabase-претензии; при
переходе на нативный Supabase Auth (Этап 5+) политики расширяются.

---

## Шаг 1. Создайте проект Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. **Connect → Connection string** — три варианта:

| Вариант | Когда использовать |
|---|---|
| Session pooler (`…pooler.supabase.com:5432`) | сервер Next.js (рекомендуется, работает в IPv4-сетях) |
| Transaction pooler (`:6543`, `pgbouncer=true`) | serverless-деплой |
| Direct connection (`db.…supabase.co:5432`) | миграции `prisma db push` |

## Шаг 2. Роль рантайма `nova_app` (не postgres!)

Серверному приложению **не** нужен суперюзер. В SQL Editor:

```sql
create role nova_app login password 'СГЕНЕРИРУЙТЕ-СВОЙ-ПАРОЛЬ';
grant usage on schema public to nova_app;
grant select, insert, update, delete on all tables in schema public to nova_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to nova_app;
```

## Шаг 3. Создайте таблицы

Способ A (рекомендуется) — с прямого подключения:

```bash
bunx prisma db push          # создаст таблицы (от владельца схемы)
bun prisma/apply-indexes.ts  # частичный уникальный индекс от дублей
bun prisma/seed.ts           # пользователи + календарь + демо-заявки
```

Способ B — чистый SQL: выполните `supabase/schema.sql` в SQL Editor
(таблицы + индексы + RLS + view, идемпотентно), затем `bun prisma/seed.ts`.

## Шаг 4. Включите RLS и публичные view

Выполните секции 2–3 `supabase/schema.sql` (если не выполняли целиком на
шаге 3). Результат:

- все таблицы — `ENABLE ROW LEVEL SECURITY`;
- политики `FOR ALL TO nova_app USING (true)` — серверному рантайму;
- `REVOKE ALL … FROM anon, authenticated` — публичного доступа к таблицам нет;
- view `public_competitions` и `public_competition_participants` —
  единственная публичная поверхность (только подтверждённые участники,
  только ФИО/команда/регион — без телефонов, e-mail, дат рождения).

Проверка (SQL Editor):

```sql
set role anon;
select * from competitions;                      -- ERROR: permission denied
select * from public_competition_participants;   -- OK, без PII
reset role;
set role nova_app;
select count(*) from applications;               -- OK
reset role;
```

## Шаг 5. Настройте `.env` сервера

```env
DATABASE_URL="postgresql://nova_app:<пароль-role>@aws-0-<region>.pooler.supabase.com:5432/postgres?connection_limit=10"

NOVA_ADMIN_EMAIL="ваш@admin.email"
NOVA_ADMIN_PASSWORD="ваш-надёжный-пароль"
NOVA_ORGANIZER_EMAIL="..."
NOVA_ORGANIZER_PASSWORD="..."
NOVA_VIEWER_EMAIL="..."
NOVA_VIEWER_PASSWORD="..."
```

Миграции (`prisma db push`) при желании выполняются отдельной командой с
прямым подключением владельца (`db.…supabase.co:5432`) — в рантайме этот
URL не используется.

## Шаг 6. Проверка

```bash
bun run dev
# открыть /admin, войти под NOVA_ADMIN_EMAIL
# подать заявку через /register — номер NOVA-ГГГГ-NNNNNN в подтверждении
```

---

## Шаг 7. Файлы документов спортсмена (Этап 5)

Файлы кабинета спортсмена (медсправка, удостоверение, паспорт) хранятся в
Supabase **Storage**, в БД — только метаданные (таблица `documents`).

1. Dashboard → **Storage → New bucket**:
   - имя: `documents` (или своё + `NOVA_DOCUMENTS_BUCKET` в .env);
   - **Private bucket** — обязательно: публичных ссылок на файлы нет.
2. В `.env` сервера:
   ```
   STORAGE_DRIVER=supabase
   SUPABASE_URL=https://PROJECT_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...   # только на сервере, никогда во фронтенд
   NOVA_DOCUMENTS_BUCKET=documents
   ```
3. Готово — код меняется не нужен: `src/lib/storage.ts` использует один
   интерфейс для `local` и `supabase` драйверов. Файл отдаётся только через
   `GET /api/files/:id` (владелец документа или staff).

Без Storage-переменных (по умолчанию) файлы пишутся в локальный каталог
`storage/documents/` — удобно для разработки.

---

## Нативный стек Supabase (перспектива)

Если позже захотите убрать собственный сервер:

1. **Auth**: организаторы в Supabase Auth, роль в `users.role`;
   политики RLS дополняются проверками JWT-претензий.
2. **API**: клиент `@supabase/supabase-js` с `anon`-ключом; фронтенд-слой
   (`data/applications.js`, `js/admin.js`) меняет только транспорт —
   сигнатуры `NOVAApplications.*` сохраняются.
3. **Подача заявок публично**: Edge Function `applications-create` — та же
   логика (окно регистрации, дубликаты, номер), что сейчас в
   `POST /api/applications`.
4. **Storage**: бакет `documents` уже используется Этапом 5 (драйвер
   `STORAGE_DRIVER=supabase`); таблица метаданных — `documents`.

Ни `service_role`, ни другие секреты никогда не добавляются во фронтенд.
