import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { normalizeEmail } from '@/lib/applications';
import { createSession, hashPassword, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email/send';
import { NextResponse } from 'next/server';

/**
 * STAGE 5/6 — POST /api/auth/register
 * Регистрация спортсмена + e-mail верификация.
 *
 * Логика (по ТЗ Этапа 5 + 6 §1.2):
 *   1. Пользователь регистрируется (e-mail + пароль + ФИО).
 *   2. Создаётся аккаунт с emailVerified=false — БЕЗ привязки гостевых
 *      заявок (Profile Claiming отложен до подтверждения адреса).
 *   3. Генерируется токен (randomUUID + случайные байты), в БД — только
 *      SHA-256 хеш (email_verifications), сырой токен уходит в письмо.
 *   4. Письмо со ссылкой /api/auth/verify?token=... — подтверждение
 *      владения адресом; клейм выполняется в GET /api/auth/verify.
 *   5. Совпадений нет/после клейма — профиль спортсмена уже связан.
 *
 * Это закрывает уязвимость п. 3.3 аудита Этапа 5: нельзя забрать чужую
 * гостевую историю, просто зная e-mail, — нужен доступ к почтовому ящику.
 *
 * Гонка двух регистраций с одинаковым e-mail разрешается уникальным
 * индексом users.email (P2002 → 409 EMAIL_TAKEN).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 'register', 12, 60_000);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(String(body?.email || ''));
    const password = String(body?.password || '');

    const fieldErrors: Record<string, string> = {};
    if (name.length < 2 || name.length > 120) fieldErrors.name = 'Укажите ФИО';
    if (!email || !EMAIL_RE.test(email)) fieldErrors.email = 'Укажите корректный e-mail';
    if (password.length < PASSWORD_MIN) {
      fieldErrors.password = `Пароль — минимум ${PASSWORD_MIN} символов`;
    }
    if (Object.keys(fieldErrors).length) throw ERR.VALIDATION(fieldErrors);

    const passwordHash = hashPassword(password);

    // e-mail уже занят другим аккаунтом → 409 (проверка + уникальный индекс)
    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw ERR.EMAIL_TAKEN();

    const user = await db.user.create({
      data: { email, passwordHash, name, role: 'athlete', emailVerified: false },
    });

    // письмо со ссылкой верификации — сбой доставки не ломает регистрацию
    // (пользователь сможет запросить ссылку заново из кабинета)
    await sendVerificationEmail({ id: user.id, email: user.email, name: user.name }).catch((e) =>
      console.error('[register] verification email failed:', e?.message)
    );

    // сессия выдаётся сразу: пользователь видит кабинет с баннером
    // «подтвердите e-mail» до активации данных
    const token = await createSession(user.id, req.headers.get('user-agent'));
    const res = NextResponse.json(
      {
        user: { email: user.email, name: user.name, role: user.role, emailVerified: false },
        needsVerification: true,
        message:
          'Аккаунт создан. Мы отправили письмо со ссылкой подтверждения — история заявок и документы откроются после верификации e-mail.',
      },
      { status: 201 }
    );
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(7 * 24 * 3600));
    return res;
  });
}
