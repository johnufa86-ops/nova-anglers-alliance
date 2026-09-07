import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { serializePublicCompetition } from '@/lib/serializers';
import { ACTIVE_STATUSES } from '@/lib/applications';

/**
 * GET /api/competitions
 * Public catalog — same shape as the legacy demo NOVA_DATA.competitions[],
 * but registration state and participants counts are REAL (from the DB).
 * Shows only public fields; never any personal data.
 */
export async function GET() {
  return handle(async () => {
    const competitions = await db.competition.findMany({
      orderBy: { startDate: 'asc' },
      include: { _count: { select: { applications: true } } },
    });

    const grouped = await db.application.groupBy({
      by: ['competitionId', 'status'],
      where: { status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    });
    const approvedGrouped = await db.application.groupBy({
      by: ['competitionId'],
      where: { status: 'approved' },
      _count: { _all: true },
    });

    const activeMap = new Map<string, number>();
    for (const g of grouped) {
      activeMap.set(g.competitionId, (activeMap.get(g.competitionId) || 0) + g._count._all);
    }
    const approvedMap = new Map<string, number>();
    for (const g of approvedGrouped) {
      approvedMap.set(g.competitionId, g._count._all);
    }

    return Response.json({
      competitions: competitions.map((c) =>
        serializePublicCompetition(c as any, {
          active: activeMap.get(c.id) || 0,
          approved: approvedMap.get(c.id) || 0,
        })
      ),
    });
  });
}
