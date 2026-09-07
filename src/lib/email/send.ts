/**
 * STAGE 6 — ядро e-mail подсистемы.
 *
 * Драйверы (EMAIL_DRIVER):
 *   resend   — Resend REST API (SDK-совместимый вызов, ключ SMTP_API_KEY).
 *              Только server-side: ключ никогда не попадает в бандл.
 *   console  — dev/песочница: письмо целиком пишется в email_log (body)
 *              и дублируется в stdout. Реальной отправки нет.
 *
 * Защита от спама (§1.4 ТЗ):
 *   - rate limit: 3 письма/мин на пользователя + 100 писем/час глобально
 *     (счётчики по email_log — переживают рестарт процесса);
 *   - idempotencyKey (unique в email_log): повторная отправка того же
 *     события (retry вебхука, повторная смена статуса) НЕ дублирует письмо;
 *   - notificationsEnabled: unsubscribe-ссылка есть в каждом письме,
 *     в том числе транзакционном (best practice) — и она работает.
 *
 * Все функции небросающие: сбой доставки не ломает основной запрос
 * (ошибка пишется в email_log.status='failed').
 */

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { BRAND, layout, paymentReceiptEmail, statusColor, statusUpdateEmail, verificationEmail } from './templates';

export const EMAIL_DRIVER = (process.env.EMAIL_DRIVER || '').trim().toLowerCase() ||
  (process.env.SMTP_API_KEY ? 'resend' : 'console');
const SMTP_API_KEY = process.env.SMTP_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'NOVA Anglers Alliance <noreply@nova-anglers.ru>';

const USER_LIMIT = { max: 3, windowMs: 60_000 };
const GLOBAL_LIMIT = { max: 100, windowMs: 3_600_000 };

/** Секрет для подписи unsubscribe-токенов (не ключи почты). */
export function appSecret(): string {
  return process.env.APP_SECRET || createHash('sha256').update(`nova-local:${process.env.DATABASE_URL || ''}`).digest('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Подписанный токен отписки для конкретного пользователя. */
export function unsubscribeTokenFor(userId: string): string {
  const mac = createHmac('sha256', appSecret()).update(`unsub:${userId}`).digest('hex');
  // userId в открытом виде безопасен: cuid не секрет, доступ защищает HMAC
  return `${userId}.${mac}`;
}

/** Проверка токена отписки → userId или null. */
export function unsubscribeUserId(token: string): string | null {
  const dot = (token || '').indexOf('.');
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(mac)) return null;
  const expected = createHmac('sha256', appSecret()).update(`unsub:${userId}`).digest('hex');
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? userId : null;
}

// ------------------------------------------------------------
// драйверы доставки
// ------------------------------------------------------------

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SMTP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

async function deliver(to: string, subject: string, html: string): Promise<void> {
  if (EMAIL_DRIVER === 'resend') {
    if (!SMTP_API_KEY) throw new Error('EMAIL_DRIVER=resend, но SMTP_API_KEY не задан (см. .env.example)');
    return sendViaResend(to, subject, html);
  }
  // console-драйвер: письмо целиком уже в email_log.body — печатаем заголовок
  console.log(`[email:console] to=${to} subject="${subject}" (${html.length} bytes)`);
}

// ------------------------------------------------------------
// ядро
// ------------------------------------------------------------

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  template: string;
  /** Уникальный ключ события: повторный вызов не дублирует письмо. */
  idempotencyKey: string;
  /** Пользователь-получатель: для rate limits и учёта unsubscribe. */
  userId?: string | null;
  /** Сохранить полный текст письма (нужен dev-драйверу и тестам). */
  storeBody?: boolean;
}

export type SendEmailResult = 'sent' | 'skipped-duplicate' | 'skipped-unsubscribed' | 'skipped-rate-limit' | 'failed';

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { to, subject, html, template, idempotencyKey, userId } = input;
  const body = input.storeBody === false ? '' : html;

  // 1. idempotency — письмо с таким ключом уже было
  const dup = await db.emailLog
    .findUnique({ where: { idempotencyKey }, select: { status: true } })
    .catch(() => null);
  if (dup) {
    console.log(`[email] skip duplicate: ${idempotencyKey}`);
    return 'skipped-duplicate';
  }

  // 2. пользователь отключил уведомления
  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } });
    if (user && !user.notificationsEnabled) return 'skipped-unsubscribed';

    // 3a. per-user rate limit (3/мин) — считаем реально отправленные
    const recent = await db.emailLog.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - USER_LIMIT.windowMs) }, status: { in: ['sent', 'pending'] } },
    });
    if (recent >= USER_LIMIT.max) {
      console.warn(`[email] user rate limit (${USER_LIMIT.max}/min) for ${userId}`);
      return 'skipped-rate-limit';
    }
  }

  // 3b. глобальный rate limit (100/час)
  const globalCount = await db.emailLog.count({
    where: { createdAt: { gte: new Date(Date.now() - GLOBAL_LIMIT.windowMs) }, status: { in: ['sent', 'pending'] } },
  });
  if (globalCount >= GLOBAL_LIMIT.max) {
    console.warn('[email] GLOBAL rate limit (100/hour) reached');
    return 'skipped-rate-limit';
  }

  // 4. пишем запись ДО доставки (уникальный ключ решает гонку retry)
  let logId: string;
  try {
    const row = await db.emailLog.create({
      data: { idempotencyKey, userId: userId ?? null, to, template, subject, body, status: 'pending' },
      select: { id: true },
    });
    logId = row.id;
  } catch (e: any) {
    if (String(e?.code) === 'P2002') return 'skipped-duplicate'; // гонка двух отправок
    throw e;
  }

  // 5. доставка — ошибка не бросается наверх
  try {
    await deliver(to, subject, html);
    await db.emailLog.update({ where: { id: logId }, data: { status: 'sent' } });
    return 'sent';
  } catch (e: any) {
    const message = String(e?.message || e).slice(0, 500);
    console.error('[email] delivery failed:', message);
    await db.emailLog.update({ where: { id: logId }, data: { status: 'failed', error: message } }).catch(() => {});
    return 'failed';
  }
}

// ------------------------------------------------------------
// отправители по ТЗ §1.1: sendVerificationEmail / sendStatusUpdate /
// sendPaymentReceipt
// ------------------------------------------------------------

const cabinetUrl = `${BRAND.baseUrl}/cabinet`;

/**
 * Токен верификации: сырая строка (randomUUID + случайные байты) уходит
 * в ссылку, в БД — только SHA-256 хеш. Возвращает сырой токен.
 */
export async function createVerificationToken(userId: string): Promise<string> {
  const raw = `${randomUUID()}${randomBytes(16).toString('hex')}`;
  await db.emailVerification.deleteMany({ where: { userId } });
  await db.emailVerification.create({
    data: { userId, token: hashToken(raw), expiresAt: new Date(Date.now() + 24 * 3600_000) },
  });
  return raw;
}

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
  name: string;
}): Promise<void> {
  const raw = await createVerificationToken(user.id);
  const url = `${BRAND.baseUrl}/api/auth/verify?token=${raw}`;
  const html = verificationEmail(user.name, url, unsubscribeTokenFor(user.id));
  await sendEmail({
    to: user.email,
    subject: 'NOVA — подтвердите e-mail',
    html,
    template: 'verification',
    idempotencyKey: `verification:${user.id}:${hashToken(raw).slice(0, 12)}`,
    userId: user.id,
  });
}

const STATUS_SUBJECTS: Record<string, string> = {
  submitted: 'заявка принята',
  under_review: 'заявка на проверке',
  approved: 'заявка подтверждена',
  needs_changes: 'заявка возвращена на доработку',
  rejected: 'заявка отклонена',
  withdrawn: 'заявка отозвана',
};

export async function sendStatusUpdate(opts: {
  userId: string;
  email: string;
  name: string;
  applicationId: string;
  applicationNumber: string;
  competitionName: string;
  status: string;
  statusLabel: string;
  comment?: string | null;
  /** Префикс ключа идемпотентности (документы используют 'doc-status'). */
  idempotencyPrefix?: string;
}): Promise<void> {
  const html = statusUpdateEmail({
    name: opts.name,
    applicationNumber: opts.applicationNumber,
    competitionName: opts.competitionName,
    status: opts.status,
    statusLabel: opts.statusLabel,
    comment: opts.comment,
    cabinetUrl,
    unsubscribeToken: unsubscribeTokenFor(opts.userId),
  });
  await sendEmail({
    to: opts.email,
    subject: `NOVA — №${opts.applicationNumber}: ${STATUS_SUBJECTS[opts.status] || 'статус обновлён'}`,
    html,
    template: `status:${opts.status}`,
    // ключ включает статус: повторная смена статуса на тот же — без дубля,
    // новая смена статуса — новое письмо
    idempotencyKey: `${opts.idempotencyPrefix || 'app-status'}:${opts.applicationId}:${opts.status}`,
    userId: opts.userId,
  });
}

export async function sendPaymentReceipt(opts: {
  userId: string;
  email: string;
  name: string;
  applicationId: string;
  applicationNumber: string;
  competitionName: string;
  amountKopecks: number;
  currency: string;
  providerId?: string | null;
}): Promise<void> {
  const html = paymentReceiptEmail({
    name: opts.name,
    applicationNumber: opts.applicationNumber,
    competitionName: opts.competitionName,
    amountKopecks: opts.amountKopecks,
    currency: opts.currency,
    providerId: opts.providerId,
    cabinetUrl,
    unsubscribeToken: unsubscribeTokenFor(opts.userId),
  });
  await sendEmail({
    to: opts.email,
    subject: `NOVA — чек: взнос по заявке №${opts.applicationNumber}`,
    html,
    template: 'payment-receipt',
    idempotencyKey: `payment-receipt:${opts.applicationId}`,
    userId: opts.userId,
  });
}

export { statusColor };
