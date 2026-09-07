import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const season = searchParams.get('season') || '2026';
    const discipline = searchParams.get('discipline');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Строим фильтр
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

    // Получаем все записи рейтинга
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

    // Группируем по спортсмену и суммируем очки
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

    // Преобразуем в массив и сортируем
    let result = Array.from(athleteMap.values()).sort((a, b) => b.points - a.points);
    
    const total = result.length;
    result = result.slice(skip, skip + limit);

    return NextResponse.json({
      data: result,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching rating:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rating', data: [], total: 0 },
      { status: 500 }
    );
  }
}