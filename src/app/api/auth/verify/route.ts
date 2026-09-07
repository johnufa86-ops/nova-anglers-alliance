// @ts-nocheck
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hashToken, createVerificationToken, sendVerificationEmail } from '@/lib/email/send';
import { claimAthleteData, ClaimedByOtherError } from '@/lib/claiming';

/**
 * STAGE 6 §1.2 — GET /api/auth/verify?token=...
 *
 * Подтверждение e-mail по ссылке из письма:
 *   - валидирует токен (SHA-256 хеш, срок 24 часа);
 *   - ставит user.emailVerified = true;
 *   - ВЫПОЛНЯЕТ отложенный Profile Claiming в одной транзакции —
 *     гостевые заявки и запись спортсмена получают userId только теперь
 *     (закрывает п. 3.3 аудита Этапа 5);
 *   - редирект в кабинет с параметром результата:
 *       ?verified=1 | invalid | expired | claimed
 *
 * Повторный клик по ссылке безопасен (идемпотентен).
 */

function redirect(result: string): NextResponse {
  const base = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
  return NextResponse.redirect(new URL(`/cabinet.html?verified=${result}`, base));
}

export async function GET(req: Request) {
  return handle(async (): Promise<Response> => {
    rateLimit(req, 'verify', 20, 60_000);

    const url = new URL(req.url);
    const raw = String(url.searchParams.get('token') || '');
    if (!raw || raw.length < 20 || raw.length > 200) return redirect('invalid');

    const record = await db.emailVerification.findUnique({
      where: { token: hashToken(raw) },
      include: { user: { select: { id: true, email: true, name: true, emailVerified: true } } },
    });
    if (!record) return redirect('invalid');
    if (record.expiresAt.getTime() < Date.now()) {
      // протухший токен удаляем — пользователь запросит свежий
      await db.emailVerification.delete({ where: { id: record.id } }).catch(() => {});
      return redirect('expired');
    }

    const user = record.user;

    // уже верифицирован (повторный клик по старой ссылке / другим токеном)
    if (user.emailVerified) {
      await db.emailVerification.update({ where: { id: record.id }, data: { verifiedAt: new Date() } }).catch(() => {});
      return redirect('1');
    }

    try {
      await db.$transaction(
        async (tx) => {
          // токен мог быть использован параллельным запросом — перечитываем
          const fresh = await tx.emailVerification.findUnique({ where: { id: record.id } });
          if (!fresh || fresh.verifiedAt || fresh.expiresAt.getTime() < Date.now()) {
            throw new AlreadyHandledError();
          }
          await tx.user.update({ where: { id: user.id }, data: { emailVerified: true } });
          await tx.emailVerification.update({ where: { id: record.id }, data: { verifiedAt: new Date() } });
          // прочие (более старые) токены пользователя больше не действительны
          await tx.emailVerification.deleteMany({ where: { userId: user.id, id: { not: record.id } } });

          // ЭТАП 6: клейм гостевых заявок ТОЛЬКО после подтверждения адреса
          await claimAthleteData(tx, user);
        },
        { timeout: 15_000 }
      );
      return redirect('1');
    } catch (e) {
      if (e instanceof AlreadyHandledError) return redirect('1');
      if (e instanceof ClaimedByOtherError) return redirect('claimed');
      throw e;
    }
  });
}

class AlreadyHandledError extends Error {}

/**
 * POST /api/auth/verify — повторная отправка письма верификации
 * (для пользователя, не нашедшего первое письмо). Требует сессии;
 * собственный лимит 3/мин + per-user лимит в e-mail ядре.
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 'verify-resend', 3, 60_000);
    const user = await getCurrentUser();
    if (!user) throw ERR.UNAUTHORIZED();

    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true, emailVerified: true },
    });
    if (!row) throw ERR.NOT_FOUND('Пользователь не найден');
    if (row.emailVerified) return Response.json({ ok: true, alreadyVerified: true });

    await createVerificationToken(user.id);
    await sendVerificationEmail({ id: user.id, email: row.email, name: row.name });
    return Response.json({ ok: true, sent: true });
  });
}
