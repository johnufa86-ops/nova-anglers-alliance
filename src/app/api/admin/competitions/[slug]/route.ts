// @ts-nocheck
import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import { ACTIVE_STATUSES, STATUS_LABELS, ENTRY_TYPE_LABELS } from '@/lib/applications';
import { registrationState } from '@/lib/serializers';

/**
 * GET /api/admin/competitions/:slug — organizer page for one competition:
 * seat usage + full application list grouped by status.
 * viewer may read; organizer must own the assignment.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const user = await requireUser(['admin', 'organizer', 'viewer']);
    const { slug } = await params;

    const c = await db.competition.findUnique({ where: { slug } });
    if (!c) throw ERR.NOT_FOUND('Соревнование не найдено');

    if (user.role === 'organizer') {
      const scope = await scopedCompetitionIds(user);
      if (scope && !scope.includes(c.id)) throw ERR.FORBIDDEN('Это соревнование не закреплено за вами');
    }

    const groupCounts = await db.application.groupBy({
      by: ['status'],
      where: { competitionId: c.id },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const g of groupCounts) {
      byStatus[g.status] = g._count._all;
      total += g._count._all;
    }
    const approved = byStatus['approved'] || 0;
    const active = ACTIVE_STATUSES.reduce((s, st) => s + (byStatus[st] || 0), 0);

    const apps = await db.application.findMany({
      where: { competitionId: c.id },
      include: {
        team: { select: { name: true } },
        participants: {
          include: { athlete: { select: { displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return Response.json({
      competition: {
        slug: c.slug,
        name: c.shortName || c.name,
        dateLabel: c.dateLabel,
        location: c.location,
        status: c.status,
        registration: registrationState(c),
        maxEntries: c.maxEntries,
      },
      seats: {
        total: c.maxEntries,
        taken: approved,
        provisional: active - approved,
        free: c.maxEntries > 0 ? Math.max(0, c.maxEntries - approved) : null,
        byStatus: byStatus,
        activeTotal: active,
      },
      applications: apps.map((a: any) => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        status: a.status,
        statusLabel: STATUS_LABELS[a.status] || a.status,
        entryType: a.entryType,
        entryTypeLabel: ENTRY_TYPE_LABELS[a.entryType] || a.entryType,
        submittedAt: a.submittedAt,
        contactEmail: a.contactEmail,
        teamName: a.team?.name || null,
        participantName: a.team?.name || a.participants?.[0]?.athlete?.displayName || '',
        roster: a.participants.map((p: any) => p.athlete.displayName),
      })),
    });
  });
}

/**
 * PUT /api/admin/competitions/:slug — update competition details.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    await requireUser(['admin', 'organizer']);
    const { slug } = await params;

    const c = await db.competition.findUnique({ where: { slug } });
    if (!c) throw ERR.NOT_FOUND('Соревнование не найдено');

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const data: any = {};
    if (body.title !== undefined || body.name !== undefined) {
      const t = String(body.title ?? body.name).trim();
      data.title = t;
      data.name = t;
    }
    if (body.shortTitle !== undefined || body.shortName !== undefined) {
      data.shortName = String(body.shortTitle ?? body.shortName).trim();
    }
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.discipline !== undefined) data.discipline = String(body.discipline).trim();
    if (body.disciplineLabel !== undefined) data.disciplineLabel = String(body.disciplineLabel).trim();
    if (body.location !== undefined) data.location = String(body.location).trim();
    if (body.region !== undefined) data.region = String(body.region).trim();
    if (body.status !== undefined) data.status = String(body.status).trim();
    if (body.prizeFund !== undefined) data.prizeFund = String(body.prizeFund).trim();
    if (body.dateLabel !== undefined) data.dateLabel = String(body.dateLabel).trim();
    if (body.organizer !== undefined) data.organizer = String(body.organizer).trim();
    if (body.contact !== undefined) data.contact = String(body.contact).trim();

    if (body.startDate !== undefined) {
      const d = new Date(body.startDate);
      data.startDate = d;
      data.date = d;
    }
    if (body.endDate !== undefined) {
      data.endDate = new Date(body.endDate);
    }
    if (body.registrationOpenAt !== undefined) {
      data.registrationOpenAt = body.registrationOpenAt ? new Date(body.registrationOpenAt) : null;
    }
    if (body.registrationCloseAt !== undefined) {
      data.registrationCloseAt = body.registrationCloseAt ? new Date(body.registrationCloseAt) : null;
    }
    if (body.maxEntries !== undefined || body.maxParticipants !== undefined) {
      const m = parseInt(body.maxEntries ?? body.maxParticipants, 10);
      data.maxEntries = m;
      data.maxParticipants = m;
    }
    if (body.fee !== undefined || body.entryFee !== undefined) {
      const f = parseFloat(body.fee ?? body.entryFee);
      data.fee = f;
      data.entryFee = Math.round(f);
    }

    const updated = await db.competition.update({
      where: { id: c.id },
      data,
    });

    return Response.json({ ok: true, competition: updated });
  });
}

/**
 * DELETE /api/admin/competitions/:slug — delete competition if no applications.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    await requireUser(['admin']);
    const { slug } = await params;

    const c = await db.competition.findUnique({
      where: { slug },
      include: { _count: { select: { applications: true } } },
    });
    if (!c) throw ERR.NOT_FOUND('Соревнование не найдено');

    if (c._count.applications > 0) {
      throw ERR.VALIDATION(null, `Нельзя удалить соревнование, на которое уже подано ${c._count.applications} заявок. Измените его статус на «archived» или удалите заявки.`);
    }

    await db.competition.delete({ where: { id: c.id } });
    return Response.json({ ok: true, deletedSlug: slug });
  });
}

