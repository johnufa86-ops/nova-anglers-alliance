import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { serializePublicCompetition } from '@/lib/serializers';
import { ACTIVE_STATUSES } from '@/lib/applications';

/** GET /api/competitions/:slug — public tournament card (no personal data). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await params;
    const c = await db.competition.findUnique({
      where: { slug },
      include: { _count: { select: { applications: true } } },
    });
    if (!c) throw ERR.NOT_FOUND('Турнир не найден');

    const active = await db.application.count({
      where: { competitionId: c.id, status: { in: ACTIVE_STATUSES } },
    });
    const approved = await db.application.count({
      where: { competitionId: c.id, status: 'approved' },
    });

    return Response.json({ competition: serializePublicCompetition(c as any, { active, approved }) });
  });
}
