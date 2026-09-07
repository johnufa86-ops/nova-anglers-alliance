/**
 * STAGE 6 — ядро e-mail подсистемы (исправлено для совместимости).
 *
 * Драйверы (EMAIL_DRIVER):
 *   resend   — Resend REST API
 *   console  — dev/песочница: письмо в email_log + stdout
 *
 * Защита от спама:
 *   - rate limit: 3/мин на пользователя + 100/час глобально
 *   - idempotencyKey (unique)
 *   - notificationsEnabled
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

export function appSecret(): string {
  return process.env.APP_SECRET || createHash('sha256').update(`nova-local:${process.env.DATABASE_URL || ''}`).digest('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function unsubscribeTokenFor(userId: string): string {
  const mac = createHmac('sha256', appSecret()).update(`unsub:${userId}`).digest('hex');
  return `${userId}.${mac}`;
}

export function unsubscribeUserId(token: string): string | null {
  const dot = (token || '').indexOf('.');
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(mac)) return null;
  const expected = createHmac('sha256', appSecret()).update(`unsub:${userId}`).digest('hex');
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(mac) as any, Buffer.from(expected) as any) ? userId : null;
}

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
    if (!SMTP_API_KEY) throw new Error('EMAIL_DRIVER=resend, но SMTP_API_KEY не задан');
    return sendViaResend(to, subject, html);
  }
  console.log(`[email:console] to=${to} subject="${subject}" (${html.length} bytes)`);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  template?: string;
  idempotencyKey?: string;
  userId?: string | null;
  storeBody?: boolean;
}

export type SendEmailResult = 'sent' | 'skipped-duplicate' | 'skipped-unsubscribed' | 'skipped-rate-limit' | 'failed';

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to;
  const subject = input.subject;
  const html = input.html;
  const template = input.template || 'generic';
  const idempotencyKey = input.idempotencyKey || `generic:${Date.now()}:${randomUUID()}:${to}`;
  const userId = input.userId ?? null;
  const body = input.storeBody === false ? '' : html;

  // 1. idempotency
  try {
    const dup = await db.emailLog.findUnique({ where: { idempotencyKey }, select: { status: true } });
    if (dup) {
      console.log(`[email] skip duplicate: ${idempotencyKey}`);
      return 'skipped-duplicate';
    }
  } catch {}

  // 2. unsubscribe
  if (userId) {
    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } });
      if (user && !user.notificationsEnabled) return 'skipped-unsubscribed';

      const recent = await db.emailLog.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - USER_LIMIT.windowMs) }, status: { in: ['sent', 'pending'] } },
      });
      if (recent >= USER_LIMIT.max) {
        console.warn(`[email] user rate limit (${USER_LIMIT.max}/min) for ${userId}`);
        return 'skipped-rate-limit';
      }
    } catch {}
  }

  try {
    const globalCount = await db.emailLog.count({
      where: { createdAt: { gte: new Date(Date.now() - GLOBAL_LIMIT.windowMs) }, status: { in: ['sent', 'pending'] } },
    });
    if (globalCount >= GLOBAL_LIMIT.max) {
      console.warn('[email] GLOBAL rate limit (100/hour) reached');
      return 'skipped-rate-limit';
    }
  } catch {}

  let logId: string;
  try {
    const row = await db.emailLog.create({
      data: { idempotencyKey, userId: userId ?? null, to, template, subject, body, status: 'pending' },
      select: { id: true },
    });
    logId = row.id;
  } catch (e: any) {
    if (String(e?.code) === 'P2002') return 'skipped-duplicate';
    // Если БД недоступна, всё равно пытаемся отправить
    console.warn('[email] log create failed, continue:', e?.message);
    try {
      await deliver(to, subject, html);
      return 'sent';
    } catch (err: any) {
      console.error('[email] delivery failed:', err?.message);
      return 'failed';
    }
  }

  try {
    await deliver(to, subject, html);
    await db.emailLog.update({ where: { id: logId }, data: { status: 'sent' } }).catch(() => {});
    return 'sent';
  } catch (e: any) {
    const message = String(e?.message || e).slice(0, 500);
    console.error('[email] delivery failed:', message);
    await db.emailLog.update({ where: { id: logId }, data: { status: 'failed', error: message } }).catch(() => {});
    return 'failed';
  }
}

const cabinetUrl = `${BRAND.baseUrl}/cabinet`;

export async function createVerificationToken(userId: string): Promise<string> {
  const raw = `${randomUUID()}${randomBytes(16).toString('hex')}`;
  try {
    await db.emailVerification.deleteMany({ where: { userId } });
    await db.emailVerification.create({
      data: { userId, token: hashToken(raw), expiresAt: new Date(Date.now() + 24 * 3600_000) },
    });
  } catch {}
  return raw;
}

function resolveHtml(maybe: string | { html: string } | any): string {
  if (typeof maybe === 'string') return maybe;
  if (maybe && typeof maybe.html === 'string') return maybe.html;
  return String(maybe);
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }): Promise<void> {
  const raw = await createVerificationToken(user.id);
  const url = `${BRAND.baseUrl}/api/auth/verify?token=${raw}`;
  const htmlRaw = (verificationEmail as any)(user.name, url, unsubscribeTokenFor(user.id));
  const html = resolveHtml(htmlRaw);
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
  idempotencyPrefix?: string;
}): Promise<void> {
  const htmlRaw = (statusUpdateEmail as any)({
    name: opts.name,
    applicationNumber: opts.applicationNumber,
    competitionName: opts.competitionName,
    status: opts.status,
    statusLabel: opts.statusLabel,
    comment: opts.comment,
    cabinetUrl,
    unsubscribeToken: unsubscribeTokenFor(opts.userId),
  });
  const html = resolveHtml(htmlRaw);
  await sendEmail({
    to: opts.email,
    subject: `NOVA — №${opts.applicationNumber}: ${STATUS_SUBJECTS[opts.status] || 'статус обновлён'}`,
    html,
    template: `status:${opts.status}`,
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
  const htmlRaw = (paymentReceiptEmail as any)({
    name: opts.name,
    applicationNumber: opts.applicationNumber,
    competitionName: opts.competitionName,
    amountKopecks: opts.amountKopecks,
    currency: opts.currency,
    providerId: opts.providerId,
    cabinetUrl,
    unsubscribeToken: unsubscribeTokenFor(opts.userId),
  });
  const html = resolveHtml(htmlRaw);
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
