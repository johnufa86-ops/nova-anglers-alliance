import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireAnyUser } from '@/lib/auth';
import { computeAthleteResults } from '@/lib/cabinet';

/**
 * GET /api/me/profile — профиль и сводка личного кабинета спортсмена.
 * PATCH /api/me/profile — редактирование профиля (name/phone/region/city/
 *                          club/sportsCategory/birthDate).
 *
 * E-mail — неизменяемый идентификатор (через него работает Profile
 * Claiming), поэтому он не редактируется.
 */

function parseBirthDate(v: unknown): Date | null | 'invalid' {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime()) || d.getTime() > Date.now()) return 'invalid';
  const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 5 || age > 110) return 'invalid';
  return d;
}

export async function GET() {
  return handle(async () => {
    const user = await requireAnyUser();

    const [athlete, results, applicationsTotal, applicationsApproved, documents] =
      await Promise.all([
        db.athlete.findUnique({ where: { userId: user.id } }),
        computeAthleteResults(user.id),
        db.application.count({ where: { userId: user.id } }),
        db.application.count({ where: { userId: user.id, status: 'approved' } }),
        db.document.groupBy({ by: ['status'], where: { userId: user.id }, _count: true }),
      ]);

    const docCounts = { total: 0, pending: 0, approved: 0 };
    for (const g of documents) {
      docCounts.total += g._count;
      if (g.status === 'pending') docCounts.pending += g._count;
      if (g.status === 'approved') docCounts.approved += g._count;
    }

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        // STAGE 6: баннер верификации и переключатель уведомлений
        emailVerified: (await db.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } }))?.emailVerified ?? false,
        notificationsEnabled: (
          await db.user.findUnique({ where: { id: user.id }, select: { notificationsEnabled: true } })
        )?.notificationsEnabled,
        createdAt: (
          await db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } })
        )?.createdAt,
      },
      athlete: athlete
        ? {
            displayName: athlete.displayName,
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            middleName: athlete.middleName,
            birthDate: athlete.birthDate,
            phone: athlete.phone,
            region: athlete.region,
            city: athlete.city,
            club: athlete.club,
            sportsCategory: athlete.sportsCategory,
          }
        : null,
      stats: {
        applicationsTotal,
        applicationsApproved,
        ratingPoints: results.totalPoints,
        competitions: results.competitions,
        documents: docCounts,
      },
    });
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    rateLimit(req, 'me-profile', 20, 60_000);
    const user = await requireAnyUser();

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const str = (v: unknown, max: number) =>
      typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : undefined;

    const name = str(body?.name, 120);
    const phone = str(body?.phone, 30);
    const region = str(body?.region, 120);
    const city = str(body?.city, 120);
    const club = str(body?.club, 120);
    const sportsCategory = str(body?.sportsCategory, 60);

    const fieldErrors: Record<string, string> = {};
    if (name !== undefined && name.length < 2) fieldErrors.name = 'Укажите ФИО';
    if (phone !== undefined && phone && phone.replace(/\D/g, '').length < 10) {
      fieldErrors.phone = 'Укажите корректный телефон';
    }
    const birth = parseBirthDate(body?.birthDate);
    if (birth === 'invalid') fieldErrors.birthDate = 'Укажите корректную дату рождения';

    if (Object.keys(fieldErrors).length) throw ERR.VALIDATION(fieldErrors);

    const athlete = await db.athlete.findUnique({ where: { userId: user.id } });
    if (!athlete) throw ERR.NOT_FOUND('Профиль спортсмена не найден');

    const result = await db.$transaction(async (tx) => {
      if (name !== undefined && name !== user.name) {
        await tx.user.update({ where: { id: user.id }, data: { name } });
      }
      const data = {
        firstName: typeof body?.firstName === 'string' ? body.firstName.trim().slice(0, 60) : athlete.firstName,
        lastName: typeof body?.lastName === 'string' ? body.lastName.trim().slice(0, 60) : athlete.lastName,
        middleName:
          body?.middleName === undefined
            ? athlete.middleName
            : typeof body.middleName === 'string' && body.middleName.trim()
              ? body.middleName.trim().slice(0, 60)
              : null,
        phone: phone !== undefined ? phone : athlete.phone,
        region: region !== undefined ? region : athlete.region,
        city: city !== undefined ? city : athlete.city,
        club: body?.club === undefined ? athlete.club : club || null,
        sportsCategory: sportsCategory !== undefined ? sportsCategory : athlete.sportsCategory,
        birthDate: body?.birthDate === undefined ? athlete.birthDate : birth,
      };
      // displayName пересобираем, если менялись ФИО-поля
      const displayName =
        [data.lastName, data.firstName].filter(Boolean).join(' ').trim() ||
        athlete.displayName ||
        name ||
        user.name;

      return tx.athlete.update({
        where: { id: athlete.id },
        data: { ...data, displayName },
      });
    });

    return Response.json({
      ok: true,
      athlete: {
        displayName: result.displayName,
        firstName: result.firstName,
        lastName: result.lastName,
        middleName: result.middleName,
        birthDate: result.birthDate,
        phone: result.phone,
        region: result.region,
        city: result.city,
        club: result.club,
        sportsCategory: result.sportsCategory,
      },
    });
  });
}
