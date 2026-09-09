import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || ''; // 'crew' | 'club'

    const teams = await (db as any).team.findMany({
      include: {
        members: {
          include: {
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    const formatted = teams.map((t: any) => {
      const athleteIds = (t.members || []).map((m: any) => m.athleteId);
      const isClub = Boolean(t.club && t.club === t.name);
      const teamType = isClub ? 'club' : 'crew';

      return {
        id: t.id,
        name: t.name,
        type: teamType,
        region: t.region || 'Регион уточняется',
        rating: 0,
        competitions: 0,
        athleteIds,
      };
    });

    const filtered = type ? formatted.filter((t: any) => t.type === type) : formatted;

    return NextResponse.json({
      teams: filtered,
      total: filtered.length,
      crewsCount: formatted.filter((t: any) => t.type === 'crew').length,
      clubsCount: formatted.filter((t: any) => t.type === 'club').length,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams', teams: [], total: 0, crewsCount: 0, clubsCount: 0 },
      { status: 500 }
    );
  }
}
