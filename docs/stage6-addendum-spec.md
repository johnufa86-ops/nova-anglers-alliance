# ЭТАП 6 — ДОПОЛНЕНИЯ ТЗ (получены 2026-09-03, сохранены на случай сбоя сессии)

## ДОП. A — СКРЫТЬ ОНЛАЙН-ЭКВАЙРИНГ (флаги)
1. `.env`/`.env.example`: `PAYMENT_ONLINE_ENABLED=false`, `PAYMENT_BANK_TRANSFER_ENABLED=true`
2. UI выбора способа: при online=false кнопка «Оплатить онлайн» скрыта; если ОБА выключены — блок оплаты скрыт, заявка создаётся без требования оплаты
3. Код эквайринга НЕ удалять — только скрыть флагом (включение = поменять переменную на true)
4. Кабинет спортсмена и админка — без упоминаний онлайн-оплаты при выключенном флаге
5. Тесты: при online=false эндпоинты эквайринга → 404/503, не принимают платежи

## ДОП. B — §2.5 ОПЛАТА ПО РЕКВИЗИТАМ (ручное подтверждение)
### 2.5.1 Два канала: онлайн (CloudPayments, реализован) + по реквизитам (перевод через свой банк + чек + ручное подтверждение организатором). Способ выбирается на этапе оплаты в кабинете.
### 2.5.2 Модели:
```prisma
model PaymentDetails {
  id              String   @id @default(uuid())
  competitionId   String?  @unique  // null = глобальные реквизиты для всех турниров
  bankName        String
  accountNumber   String   // расчётный счёт 40802...
  bik             String
  inn             String?
  recipientName   String   // ФИО ИП или название организации
  paymentPurpose  String   // шаблон назначения платежа
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
// В модель Payment добавить:
  method          String   // "online" | "bank_transfer"
  proofFileUrl    String?  // путь к чеку в Storage (для bank_transfer)
  proofStatus     String?  // awaiting_review, confirmed, rejected
  rejectReason    String?  // комментарий организатора при отклонении
  confirmedById   String?  // userId организатора
  confirmedAt     DateTime?
```
### 2.5.3 Реквизиты: организатор редактирует в админке /admin/payment-details; глобальные (competitionId=null) или переопределение на соревнование; валидация: р/с 20 цифр, БИК 9 цифр, ИНН 10/12 цифр
### 2.5.4 Спортсмен: блок «Оплата» с выбором 💳 «Оплатить онлайн» / 🏦 «Оплатить по реквизитам»; при реквизитах: сумма взноса, реквизиты (банк/счёт/БИК/получатель), назначение с автоподстановкой «Целевой организационный взнос за участие в [название], [ФИО спортсмена]», кнопка «Скопировать реквизиты»; загрузка чека drag-n-drop JPG/PNG/PDF, magic bytes, лимит 5 МБ, приватный бакет (как документы); method=bank_transfer, proofStatus=awaiting_review; email «Подтверждение оплаты получено и ожидает проверки организатором»
### 2.5.5 Организатор (карточка заявки /admin/application?id=): при method=bank_transfer — превью чека + «Скачать», кнопки «Подтвердить оплату»/«Отклонить»; подтверждение: proofStatus=confirmed, status=paid, Application→approved (если документы в порядке), email «Оплата подтверждена, вы допущены к соревнованию»; отклонение: ОБЯЗАТЕЛЬНЫЙ комментарий («Неверная сумма», «Нечитаемый чек»), proofStatus=rejected, email с причиной и предложением загрузить новый чек; спортсмен может загрузить новый чек после отклонения (замена файла)
### 2.5.6 Таймаут: awaiting_review старше 48 ч → expired; email «Оплата не получена в срок, заявка аннулирована»; ленивая проверка при чтении списка (как документы Этапа 5)
### 2.5.7 Безопасность: приватный бакет, доступ через авторизованный API; организатор видит чеки только своих соревнований; спортсмен — только свой чек; magic bytes PDF/JPEG/PNG; лимит 5 МБ; rate limit загрузки чеков 5/час на пользователя; Content-Disposition: attachment
### 2.5.8 Кабинет: блок ОПЛАТА (способ, сумма, реквизиты, назначение, [Скопировать реквизиты], статус ⏳ Ожидает проверки, [Загрузить новый чек])
### 2.5.9 Приёмка: 1) выбор реквизитов → чек → «ожидает проверки» 2) организатор подтверждает → approved + email 3) отклонение с комментарием → причина видна → новый чек 4) чужой чек 404 5) реквизиты в админке 6) таймаут 48ч 7) 20+ новых тестов
### 2.5.10 .env.example: BANK_TRANSFER_ENABLED=true, BANK_TRANSFER_TIMEOUT_HOURS=48

## §3 — АВТОМАТИЧЕСКИЙ ПЕРЕСЧЁТ РЕЙТИНГА NOVA
Контекст: минимальный контур есть (GET /api/rating + /rating.html). Расширить до полноценной системы.
### 3.1 Формула — src/config/rating.ts:
```typescript
export const RATING_CONFIG = {
  points: { 1: 100, 2: 80, 3: 60, range4to10: 40, participation: 10 },
  massBonus: { threshold: 50, multiplier: 1.2 },
  seasonFormat: 'YYYY',
};
```
### 3.2 Триггер: кнопка «Рассчитать рейтинг» в /admin/competition/:slug (вручную); альтернативно авто через 24ч после турнира, если организатор не запустил; НЕ пересчитывать при каждом запросе
### 3.3 Хранение:
```prisma
model RatingEntry {
  id            String   @id @default(uuid())
  athleteId     String
  competitionId String
  place         Int
  points        Int
  season        String
  calculatedAt  DateTime @default(now())
  @@unique([athleteId, competitionId])
}
```
Пересчёт: 1) взять протокол соревнования 2) применить формулу 3) upsert RatingEntry каждому участнику 4) обновить кэш публичного рейтинга
### 3.4 Публичный рейтинг: расширить GET /api/rating — агрегация по сезону (сумма очков), фильтры ?season=2026&discipline=spinning&category=boat, топ-50 по умолчанию + пагинация; без PII (имя+фамилия, клуб/регион опционально); кэш 5 минут in-memory; /rating.html — таблица с фильтрами, подсветка топ-3, поиск
### 3.5 Кабинет: текущее место в рейтинге, сумма очков за сезон, история начислений (турнир → место → очки)
### 3.6 Защита: рейтинг ТОЛЬКО из протоколов организатора; спортсмен не влияет на очки; все изменения RatingEntry логируются
### Приёмка: 1) кнопка → очки начислены 2) публичный обновлён, фильтры, без PII 3) кабинет: место и история 4) повторный расчёт без дублей (upsert) 5) 15+ тестов + регресс 131
### Результат: ZIP, документация по формуле рейтинга, инструкция по запуску пересчёта

## ПОРЯДОК РАБОТ (план подтверждён пользователем)
1. Восстановить среду (PG 5433, .env, db push, сид) — .env сбит шаблоном sqlite
2. Схема: PaymentDetails + Payment-поля + RatingEntry; apply-indexes (partial unique для глобальных реквизитов); supabase/schema.sql
3. Флаги в payments.ts, 404 на create/checkout при online=false, /api/payments/config
4. API/страница /admin/payment-details (валидация, upsert, глобальные+на турнир)
5. Спортсмен: выбор способа, реквизиты+назначение, копирование, POST /api/me/payments/proof
6. Организатор: PATCH /api/admin/payments/[id] confirm/reject, скоуп по OrganizerAssignment
7. Таймаут 48 ч: lazyExpireBankTransferPayments в списках me/admin
8. UI: cabinet-applications.html (выбор способа, чек, статусы), admin/application.html (чек, кнопки), скрытие онлайн
9. §3: config/rating.ts, POST /api/admin/competitions/[slug]/recalc-rating, авто-24ч, GET /api/rating (season/discipline/category, топ-50, пагинация, кэш 5 мин), кабинет (место/очки/история), логирование изменений
10. Тесты: 20+ банк-перевод, 15+ рейтинг, регресс 131 (54+60+10+7), tsc/eslint
11. Seed-демо (реквизиты, чек на проверке), README (формула+инструкция), ZIP stage6, worklog Task 10
