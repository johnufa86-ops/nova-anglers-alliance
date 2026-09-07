import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import { ACTIVE_STATUSES, STATUS_LABELS, ENTRY_TYPE_LABELS } from '@/lib/applications';
import { registrationState } from '@/lib/serializers';

/**
 * GET /api/admin/competitions/:slug — organizer page for one competition:
 * seat usage + full application list grouped by status.
 * viewer may read; organizer must own the assignment.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const user = await requireUser(['admin', 'organizer', 'viewer']);
    const { slug } = await params;

    const c = await db.competition.findUnique({ where: { slug } });
    if (!c) throw ERR.NOT_FOUND('Соревнование не найдено');

    if (user.role === 'organizer') {
      const scope = await scopedCompetitionIds(user);
      if (scope && !scope.includes(c.id)) throw ERR.FORBIDDEN('Это соревнование не закреплено за вами');
    }

    const groupCounts = await db.application.groupBy({
      by: ['status'],
      where: { competitionId: c.id },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const g of groupCounts) {
      byStatus[g.status] = g._count._all;
      total += g._count._all;
    }
    const approved = byStatus['approved'] || 0;
    const active = ACTIVE_STATUSES.reduce((s, st) => s + (byStatus[st] || 0), 0);

    const apps = await db.application.findMany({
      where: { competitionId: c.id },
      include: {
        team: { select: { name: true } },
        participants: {
          include: { athlete: { select: { displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return Response.json({
      competition: {
        slug: c.slug,
        name: c.shortName || c.name,
        dateLabel: c.dateLabel,
        location: c.location,
        status: c.status,
        registration: registrationState(c),
        maxEntries: c.maxEntries,
      },
      seats: {
        total: c.maxEntries,
        taken: approved,
        provisional: active - approved,
        free: c.maxEntries > 0 ? Math.max(0, c.maxEntries - approved) : null,
        byStatus: byStatus,
        activeTotal: active,
      },
      applications: apps.map((a: any) => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        status: a.status,
        statusLabel: STATUS_LABELS[a.status] || a.status,
        entryType: a.entryType,
        entryTypeLabel: ENTRY_TYPE_LABELS[a.entryType] || a.entryType,
        submittedAt: a.submittedAt,
        contactEmail: a.contactEmail,
        teamName: a.team?.name || null,
        participantName: a.team?.name || a.participants?.[0]?.athlete?.displayName || '',
        roster: a.participants.map((p: any) => p.athlete.displayName),
      })),
    });
  });
}
