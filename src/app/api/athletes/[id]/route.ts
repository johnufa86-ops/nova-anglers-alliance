import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID не указан' }, { status: 400 });
    }

    const athlete = await (db as any).athlete.findFirst({
      where: {
        OR: [
          { id },
          { displayName: { equals: decodeURIComponent(id), mode: 'insensitive' } },
        ],
      },
      include: {
        results: {
          include: {
            competition: {
              select: {
                id: true,
                slug: true,
                title: true,
                name: true,
                date: true,
                discipline: true,
                location: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        ratingEntries: {
          include: {
            competition: {
              select: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        teamMembers: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                region: true,
              },
            },
          },
        },
        applicationParticipants: {
          include: {
            application: {
              include: {
                competition: {
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    date: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Спортсмен не найден' }, { status: 404 });
    }

    const fullName = [athlete.firstName, athlete.lastName].filter(Boolean).join(' ').trim();
    const name = athlete.displayName || fullName || 'Спортсмен NOVA';
    const initials = ((athlete.firstName?.[0] || '') + (athlete.lastName?.[0] || '')).toUpperCase() || 'NA';
    const rating = (athlete.ratingEntries || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
    const competitions = (athlete.results?.length || 0) + (athlete.applicationParticipants?.length || 0);
    const wins = (athlete.results || []).filter((r: any) => r.place === 1).length;
    const team = athlete.teamMembers?.[0]?.team || null;

    // Сбор истории турниров
    const compsList = [
      ...(athlete.results || []).map((r: any) => ({
        id: r.competition?.slug || r.competition?.id,
        shortTitle: r.competition?.title || r.competition?.name || 'Турнир NOVA',
        date: r.competition?.date ? new Date(r.competition.date).toLocaleDateString('ru-RU') : '2026',
        discipline: r.competition?.discipline || 'Спиннинг',
        place: r.place ? `${r.place} место` : '—',
        points: r.points ? `+${r.points}` : '—',
      })),
      ...(athlete.applicationParticipants || []).map((ap: any) => ({
        id: ap.application?.competition?.slug || ap.application?.competition?.id,
        shortTitle: ap.application?.competition?.title || 'Турнир NOVA',
        date: ap.application?.competition?.date ? new Date(ap.application.competition.date).toLocaleDateString('ru-RU') : '10 октября 2026',
        discipline: 'Береговой спиннинг',
        place: ap.application?.status === 'approved' ? 'Заявка подтверждена' : 'Ожидает',
        points: '—',
      })),
    ];

    return NextResponse.json({
      athlete: {
        id: athlete.id,
        name,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        middleName: athlete.middleName,
        initials,
        region: athlete.region || athlete.city || 'Республика Башкортостан',
        city: athlete.city || 'Уфа',
        club: athlete.club || null,
        sportsCategory: athlete.sportsCategory || null,
        photoUrl: athlete.photoUrl || '',
        bio: athlete.bio || 'Спортсмен рыболовного альянса NOVA.',
        teamId: team ? team.id : null,
        teamName: team ? team.name : null,
        rating,
        competitions,
        wins,
        competitionsList: compsList,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/athletes/[id] error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH /api/athletes/:id — обновление профиля (включая фото и био) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = ['photoUrl', 'bio', 'club', 'city', 'region', 'sportsCategory'];
    const updateData: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const updated = await (db as any).athlete.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, athlete: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
