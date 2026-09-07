import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { participantDisplayName } from '@/lib/applications';

/**
 * GET /api/applications/lookup?number=NOVA-...&token=...
 *
 * Lets the applicant re-open the confirmation screen from any device.
 * The access token (issued at submit time) is required — application
 * numbers alone are NOT enough to read application data publicly.
 * Returns only what the confirmation screen needs, incl. the applicant's
 * own form data (needed for the "Скачать заявку" txt).
 */
export async function GET(req: Request) {
  return handle(async () => {
    rateLimit(req, 'lookup', 30, 60_000);

    const url = new URL(req.url);
    const number = (url.searchParams.get('number') || '').trim();
    const token = (url.searchParams.get('token') || '').trim();
    if (!number || !token) throw ERR.NOT_FOUND('Заявка не найдена. Проверьте ссылку.');

    const app = await db.application.findUnique({
      where: { applicationNumber: number },
      include: {
        competition: { select: { slug: true, name: true, shortName: true, dateLabel: true, location: true } },
      },
    });
    if (!app || app.accessToken !== token) {
      throw ERR.NOT_FOUND('Заявка не найдена. Проверьте ссылку или номер заявки.');
    }

    let payload: any = {};
    try {
      payload = JSON.parse(app.rawPayload || '{}');
    } catch {}

    return Response.json({
      application: {
        applicationNumber: app.applicationNumber,
        status: app.status,
        entryType: app.entryType,
        submittedAt: app.submittedAt,
        participantName: participantDisplayName(app.entryType, payload),
        participant: payload,
        competition: app.competition
          ? {
              slug: app.competition.slug,
              title: app.competition.name,
              shortTitle: app.competition.shortName || app.competition.name,
              dateLabel: app.competition.dateLabel,
              place: app.competition.location,
            }
          : null,
      },
    });
  });
}
