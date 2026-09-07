import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { calculatePointsForPlace } from '@/config/rating';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comp = await (db as any).competition.findUnique({
    where: { slug },
    include: { organizerAssignments: true, results: true },
  });

  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 });

  const isAssigned = comp.organizerAssignments?.some((a: any) => a.userId === user.id);
  const isAdmin = user.role === 'admin';
  if (!isAssigned && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const totalParticipants = comp.results.length;
  const season = comp.date ? new Date(comp.date).getFullYear().toString() : new Date().getFullYear().toString();

  let count = 0;
  for (const item of comp.results) {
    const points = calculatePointsForPlace(item.place, totalParticipants);
    await (db as any).ratingEntry.upsert({
      where: {
        athleteId_competitionId: {
          athleteId: item.athleteId,
          competitionId: comp.id,
        },
      },
      update: {
        place: item.place,
        points,
        season,
        calculatedAt: new Date(),
      },
      create: {
        athleteId: item.athleteId,
        competitionId: comp.id,
        place: item.place,
        points,
        season,
      },
    });
    count++;
  }

  console.log(`[Audit] Расчет рейтинга: ${user.id} для comp ${comp.id}, участников: ${count}`);
  return NextResponse.json({ success: true, calculatedCount: count, season });
}
