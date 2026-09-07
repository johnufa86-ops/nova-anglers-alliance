import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { unsubscribeUserId } from '@/lib/email/send';

/**
 * STAGE 6 §1.4 — GET /api/unsubscribe?token=...
 *
 * Отписка от уведомлений. Ссылка есть в ПОДВАЛЕ КАЖДОГО письма, включая
 * транзакционные (best practice). Токен — userId + HMAC-SHA256(APP_SECRET):
 * подделать нельзя, но и перечисления пользователей он не раскрывает.
 *
 * Транзакционные письма (верификация, статусы, чеки) при отключённых
 * уведомлениях больше не отправляются — решение пользователя уважается.
 * Вернуть уведомления можно в кабинете (профиль).
 */

function redirect(hash: string): NextResponse {
  const base = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
  return NextResponse.redirect(new URL(`/cabinet.html?unsubscribed=${hash}`, base));
}

export async function GET(req: Request) {
  return handle(async (): Promise<Response> => {
    const url = new URL(req.url);
    const userId = unsubscribeUserId(String(url.searchParams.get('token') || ''));
    if (!userId) return redirect('invalid');

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return redirect('invalid');

    await db.user.update({ where: { id: user.id }, data: { notificationsEnabled: false } });
    return redirect('1');
  });
}
