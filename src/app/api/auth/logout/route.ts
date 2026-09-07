import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { handle } from '@/lib/api';

/** POST /api/auth/logout — invalidate the current session. */
export async function POST() {
  return handle(async () => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
    return res;
  });
}
