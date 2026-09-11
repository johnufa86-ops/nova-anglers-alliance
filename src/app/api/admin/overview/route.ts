import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import { ACTIVE_STATUSES } from '@/lib/applications';

/**
 * GET /api/admin/overview — organizer dashboard KPIs + working queues.
 * viewer/organizer/admin; `organizer` sees only assigned competitions.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser(['admin', 'organizer', 'viewer']);
    const scope = await scopedCompetitionIds(user);
    const compFilter = scope ? { id: { in: scope } } : {};
    const appFilter = { competition: compFilter };

    const [activeCompetitions, totalApplications, newApplications, approvedParticipants] =
      await Promise.all([
        db.competition.count({
          where: { ...compFilter, status: { in: ['registration_open', 'in_progress', 'upcoming', 'live'] } },
        }),
        db.application.count({ where: appFilter }),
        db.application.count({ where: { ...appFilter, status: 'submitted' } }),
        db.applicationParticipant.count({
          where: { application: { ...appFilter, status: 'approved' } },
        }),
      ]);

    const recent = await db.application.findMany({
      where: appFilter,
      include: {
        competition: { select: { slug: true, shortName: true, name: true } },
        team: { select: { name: true } },
        participants: { include: { athlete: { select: { displayName: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 8,
    });

    const needsReview = await db.application.findMany({
      where: { ...appFilter, status: { in: ['submitted', 'needs_changes'] } },
      include: {
        competition: { select: { slug: true, shortName: true, name: true } },
        participants: { include: { athlete: { select: { displayName: true } } } },
      },
      orderBy: { submittedAt: 'asc' },
      take: 8,
    });

    const openRegistrations = await db.competition.findMany({
      where: { ...compFilter, status: { in: ['registration_open', 'upcoming', 'live'] } },
      include: { _count: { select: { applications: true } } },
      orderBy: { startDate: 'asc' },
      take: 8,
    });

    const activeCounts = await db.application.groupBy({
      by: ['competitionId'],
      where: { ...appFilter, status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    });
    const activeMap = new Map(activeCounts.map((g) => [g.competitionId, g._count._all]));

    return Response.json({
      kpis: { activeCompetitions, totalApplications, newApplications, approvedParticipants },
      recent: recent.map(serialiseRow),
      needsReview: needsReview.map(serialiseRow),
      openRegistrations: openRegistrations.map((c) => ({
        slug: c.slug,
        name: c.shortName || c.name,
        startDate: c.startDate,
        maxEntries: c.maxEntries,
        registered: activeMap.get(c.id) || 0,
      })),
    });
  });
}

function serialiseRow(a: any) {
  const first = a.participants?.[0]?.athlete?.displayName || '';
  return {
    id: a.id,
    applicationNumber: a.applicationNumber,
    status: a.status,
    entryType: a.entryType,
    submittedAt: a.submittedAt,
    contactEmail: a.contactEmail,
    competition: a.competition ? { slug: a.competition.slug, name: a.competition.shortName || a.competition.name } : null,
    teamName: a.team?.name || null,
    participantName: a.team?.name || first,
  };
}
