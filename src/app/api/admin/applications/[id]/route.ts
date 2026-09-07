import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import { STATUS_LABELS, ENTRY_TYPE_LABELS } from '@/lib/applications';

/** GET /api/admin/applications/:id — full application card (organizer only). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(['admin', 'organizer', 'viewer']);
    const { id } = await params;

    const app = await db.application.findUnique({
      where: { id },
      include: {
        competition: { select: { id: true, slug: true, name: true, shortName: true, dateLabel: true, location: true, maxEntries: true } },
        team: { select: { id: true, name: true, region: true, club: true } },
        participants: {
          include: {
            athlete: {
              select: {
                id: true, firstName: true, lastName: true, middleName: true,
                displayName: true, birthDate: true, phone: true, email: true,
                region: true, city: true, club: true, sportsCategory: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: { changedBy: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!app) throw ERR.NOT_FOUND('Заявка не найдена');

    // organizer scoping
    if (user.role === 'organizer') {
      const scope = await scopedCompetitionIds(user);
      if (scope && !scope.includes(app.competitionId)) throw ERR.FORBIDDEN('Это соревнование не закреплено за вами');
    }

    let rawPayload: any = {};
    try {
      rawPayload = JSON.parse(app.rawPayload || '{}');
    } catch {}

    return Response.json({
      application: {
        id: app.id,
        applicationNumber: app.applicationNumber,
        status: app.status,
        statusLabel: STATUS_LABELS[app.status] || app.status,
        entryType: app.entryType,
        entryTypeLabel: ENTRY_TYPE_LABELS[app.entryType] || app.entryType,
        submittedAt: app.submittedAt,
        updatedAt: app.updatedAt,
        reviewedAt: app.reviewedAt,
        comment: app.comment,
        notes: app.notes,
        contactEmail: app.contactEmail,
        contactPhone: app.contactPhone,
        competition: app.competition
          ? {
              slug: app.competition.slug,
              name: app.competition.shortName || app.competition.name,
              dateLabel: app.competition.dateLabel,
              location: app.competition.location,
            }
          : null,
        team: app.team,
        participants: app.participants.map((p: any) => ({
          id: p.id,
          role: p.role,
          athlete: {
            displayName: p.athlete.displayName,
            firstName: p.athlete.firstName,
            lastName: p.athlete.lastName,
            middleName: p.athlete.middleName,
            birthDate: p.athlete.birthDate,
            phone: p.athlete.phone,
            email: p.athlete.email,
            region: p.athlete.region,
            city: p.athlete.city,
            club: p.athlete.club,
            sportsCategory: p.athlete.sportsCategory,
          },
        })),
        history: app.history.map((h: any) => ({
          id: h.id,
          oldStatus: h.oldStatus,
          newStatus: h.newStatus,
          newStatusLabel: STATUS_LABELS[h.newStatus] || h.newStatus,
          oldStatusLabel: h.oldStatus ? STATUS_LABELS[h.oldStatus] || h.oldStatus : null,
          changedBy: h.changedBy ? `${h.changedBy.name} (${h.changedBy.role})` : 'Система',
          comment: h.comment,
          createdAt: h.createdAt,
        })),
        rawPayload,
      },
    });
  });
}
