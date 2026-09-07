import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { serializePublicParticipant } from '@/lib/serializers';

/**
 * GET /api/competitions/:slug/participants
 *
 * PUBLIC participants list for the tournament page.
 * Data-minimization (spec §17/§18): only display-level fields leave the
 * server — name, team, region. Phones, e-mails, birthdates, comments and
 * non-approved applications are NOT readable publicly.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await params;
    const c = await db.competition.findUnique({ where: { slug }, select: { id: true } });
    if (!c) throw ERR.NOT_FOUND('Турнир не найден');

    const parts = await db.applicationParticipant.findMany({
      where: {
        application: {
          competitionId: c.id,
          status: 'approved', // публично — только подтверждённые участники
        },
      },
      include: {
        athlete: { select: { displayName: true, region: true, club: true } },
        application: {
          select: {
            applicationNumber: true,
            entryType: true,
            status: true,
            team: { select: { name: true, region: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Response.json({ participants: parts.map(serializePublicParticipant) });
  });
}
