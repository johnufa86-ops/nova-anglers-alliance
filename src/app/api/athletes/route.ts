import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get('region') || '';
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (region && region !== 'all') {
      where.region = region;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const athletes = await (db as any).athlete.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        city: true,
        club: true,
        region: true,
        ratingEntries: {
          select: { points: true },
        },
        results: {
          select: { id: true, place: true },
        },
        teamMembers: {
          select: {
            team: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const formatted = athletes.map((a: any) => {
      const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
      const name = a.displayName || fullName || 'Спортсмен NOVA';
      const initials = ((a.firstName?.[0] || '') + (a.lastName?.[0] || '')).toUpperCase() || 'NA';
      const rating = (a.ratingEntries || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      const competitions = a.results?.length || 0;
      const wins = (a.results || []).filter((r: any) => r.place === 1).length;
      const podiums = (a.results || []).filter((r: any) => r.place >= 1 && r.place <= 3).length;
      const team = a.teamMembers?.[0]?.team || null;

      return {
        id: a.id,
        name,
        initials,
        region: a.region || a.city || 'Регион уточняется',
        teamId: team ? team.id : null,
        teamName: team ? team.name : null,
        rating,
        competitions,
        wins,
        podiums,
      };
    });

    formatted.sort((a: any, b: any) => b.rating - a.rating);
    const regions = Array.from(new Set(formatted.map((a: any) => a.region).filter(Boolean))).sort();

    return NextResponse.json({
      athletes: formatted,
      total: formatted.length,
      regions,
    });
  } catch (error) {
    console.error('Error fetching athletes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch athletes', athletes: [], total: 0, regions: [] },
      { status: 500 }
    );
  }
}
