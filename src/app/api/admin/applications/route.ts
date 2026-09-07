import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import { APPLICATION_STATUSES, lazyExpireApplications } from '@/lib/applications';

/**
 * GET /api/admin/applications
 * Filterable, searchable applications table for the organizer.
 *
 * Query params:
 *   q            — search: application number / name / e-mail / team name
 *   competition  — competition slug
 *   status       — one of APPLICATION_STATUSES (or "all")
 *   type         — athlete | team (or "all")
 *   dateFrom / dateTo — submittedAt range (YYYY-MM-DD)
 *   page / pageSize   — pagination
 */
export async function GET(req: Request) {
  return handle(async () => {
    await lazyExpireApplications();
    const user = await requireUser(['admin', 'organizer', 'viewer']);
    const scope = await scopedCompetitionIds(user);

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const competitionSlug = url.searchParams.get('competition') || '';
    const status = url.searchParams.get('status') || 'all';
    const type = url.searchParams.get('type') || 'all';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));

    const where: any = {};
    if (scope) where.competitionId = { in: scope };
    if (competitionSlug && competitionSlug !== 'all') {
      const comp = await db.competition.findUnique({ where: { slug: competitionSlug }, select: { id: true } });
      if (!comp) throw ERR.NOT_FOUND('Соревнование не найдено');
      where.competitionId = scope && !scope.includes(comp.id) ? '__none__' : comp.id;
    }
    if (status !== 'all') {
      if (!APPLICATION_STATUSES.includes(status as any)) throw ERR.VALIDATION({ status: 'Неизвестный статус' });
      where.status = status;
    }
    if (type === 'athlete' || type === 'team') where.entryType = type;
    if (dateFrom || dateTo) {
      where.submittedAt = {};
      if (dateFrom) where.submittedAt.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) where.submittedAt.lte = new Date(`${dateTo}T23:59:59.999`);
    }

    if (q) {
      // SQLite LIKE is ASCII-insensitive only — search a few case variants
      const lower = q.charAt(0).toLowerCase() + q.slice(1);
      const upper = q.charAt(0).toUpperCase() + q.slice(1);
      const variants = Array.from(new Set([q, lower, upper]));
      where.OR = [
        ...variants.map((v) => ({ applicationNumber: { contains: v } })),
        ...variants.map((v) => ({ contactEmail: { contains: v.toLowerCase() } })),
        ...variants.map((v) => ({ team: { name: { contains: v } } })),
        ...variants.map((v) => ({ participants: { some: { athlete: { displayName: { contains: v } } } } })),
      ];
    }

    const [total, rows] = await Promise.all([
      db.application.count({ where }),
      db.application.findMany({
        where,
        include: {
          competition: { select: { slug: true, shortName: true, name: true } },
          team: { select: { name: true } },
          participants: { include: { athlete: { select: { displayName: true } } } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return Response.json({
      total,
      page,
      pageSize,
      applications: rows.map((a: any) => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        status: a.status,
        entryType: a.entryType,
        submittedAt: a.submittedAt,
        contactEmail: a.contactEmail,
        contactPhone: a.contactPhone,
        competition: a.competition
          ? { slug: a.competition.slug, name: a.competition.shortName || a.competition.name }
          : null,
        teamName: a.team?.name || null,
        participantName: a.team?.name || a.participants?.[0]?.athlete?.displayName || '',
        participantsCount: a.participants?.length || 0,
      })),
    });
  });
}
