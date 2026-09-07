import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCachedAggregatedRating } from '@/lib/rating';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const season = searchParams.get('season') || '2026';
    const discipline = searchParams.get('discipline') || '';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const cacheKey = `rating:${season}:${discipline}:${search}:${page}:${limit}`;

    const result = await getCachedAggregatedRating(cacheKey, async () => {
      const where: any = { season };

      if (discipline) {
        where.competition = { discipline };
      }

      if (search) {
        where.athlete = {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        };
      }

      const entries = await (db as any).ratingEntry.findMany({
        where,
        include: {
          athlete: {
            select: {
              firstName: true,
              lastName: true,
              city: true,
              club: true,
            },
          },
        },
        orderBy: { points: 'desc' },
      });

      const athleteMap = new Map();

      for (const entry of entries) {
        const athleteId = entry.athleteId;
        if (!athleteMap.has(athleteId)) {
          athleteMap.set(athleteId, {
            athlete: entry.athlete,
            points: 0,
            competitionsCount: 0,
          });
        }
        const data = athleteMap.get(athleteId);
        data.points += entry.points;
        data.competitionsCount += 1;
      }

      let aggregated = Array.from(athleteMap.values()).sort((a, b) => b.points - a.points);
      const total = aggregated.length;
      const sliced = aggregated.slice(skip, skip + limit);

      return {
        data: sliced,
        total,
        page,
        limit,
        cachedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching rating:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rating', data: [], total: 0 },
      { status: 500 }
    );
  }
}
