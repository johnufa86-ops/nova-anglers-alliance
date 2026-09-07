import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import {
  createSession,
  destroySession,
  sessionCookieOptions,
  verifyPassword,
  SESSION_COOKIE,
} from '@/lib/auth';

/** POST /api/auth/login — organizer/admin/viewer sign-in (email + password). */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 'login', 10, 60_000);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      throw ERR.VALIDATION({ email: !email, password: !password }, 'Укажите e-mail и пароль');
    }

    const user = await db.user.findUnique({ where: { email } });
    // generic message — never reveal which part was wrong
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw ERR.FORBIDDEN('Неверный e-mail или пароль');
    }

    const token = await createSession(user.id, req.headers.get('user-agent'));
    const res = NextResponse.json({
      user: { email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(7 * 24 * 3600));
    return res;
  });
}

/** DELETE /api/auth/login — convenience alias for logout via same path. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
    return res;
  });
}
