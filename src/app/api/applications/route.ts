import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import {
  normalizeEmail,
  participantDisplayName,
  splitFullName,
  ACTIVE_STATUSES,
} from '@/lib/applications';
import { getCurrentUser } from '@/lib/auth';
import { sendStatusUpdate } from '@/lib/email/send';

/**
 * POST /api/applications — submit a registration application.
 *
 * Server-side pipeline (the browser is never trusted):
 *   1. validate payload (cheap checks, outside the transaction)
 *   2. ONE transaction, serialized per competition:
 *      2a. SELECT ... FOR UPDATE on the competition row — every concurrent
 *          submission for the same competition queues up here, so all
 *          further checks are race-free (Stage 4.1 fix);
 *      2b. registration must be open RIGHT NOW (status + window) — re-read
 *          under the lock, so an organizer closing registration mid-flight
 *          always wins;
 *      2c. seat limit — active applications counted inside the same
 *          transaction that inserts the new one (no check-then-insert gap);
 *      2d. duplicate check (competition + contact e-mail) — under the same
 *          lock, plus a partial unique index in the DB as the hard guarantee
 *          (prisma/apply-indexes.ts) with P2002 → DUPLICATE fallback;
 *      2e. athlete/team + participants + application + server-generated
 *          unique number + status history.
 *   3. return confirmation (number + access token)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asStringRecord(body: any): Record<string, any> | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

function validateAthlete(p: Record<string, any>): string[] {
  const errors: string[] = [];
  if (!str(p.lastname)) errors.push('lastname');
  if (!str(p.firstname)) errors.push('firstname');
  if (!str(p.email) || !EMAIL_RE.test(str(p.email))) errors.push('email');
  if (str(p.phone).replace(/\D/g, '').length < 10) errors.push('phone');
  if (!str(p.region)) errors.push('region');
  if (!str(p.city)) errors.push('city');
  if (!str(p.birthdate)) {
    errors.push('birthdate');
  } else {
    const d = new Date(str(p.birthdate));
    const now = new Date();
    if (isNaN(d.getTime()) || d > now) errors.push('birthdate');
    else {
      const age = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 10 || age > 100) errors.push('birthdate');
    }
  }
  return errors;
}

function validateTeam(p: Record<string, any>): string[] {
  const errors: string[] = [];
  if (!str(p.name)) errors.push('name');
  const roster = Array.isArray(p.roster) ? p.roster.map(str).filter(Boolean) : [];
  if (!roster.length) errors.push('roster');
  if (!str(p.email) || !EMAIL_RE.test(str(p.email))) errors.push('email');
  if (str(p.phone).replace(/\D/g, '').length < 10) errors.push('phone');
  if (!str(p.region)) errors.push('region');
  if (!str(p.city)) errors.push('city');
  return errors;
}

type LockedCompetitionRow = {
  id: string;
  status: string;
  entryType: string;
  maxEntries: number;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
};

/**
 * Marker thrown INSIDE the transaction when a duplicate is found.
 * The friendly DUPLICATE response is built AFTER the transaction closes
 * (querying the DB inside an open transaction would need a second pool
 * connection → pool exhaustion under concurrency). Never let this escape.
 */
class DuplicateDetected extends Error {}

/** Friendly duplicate error built from the existing active application. */
async function duplicateError(competitionId: string, contactEmail: string) {
  const duplicate = await db.application.findFirst({
    where: {
      competitionId,
      contactEmail,
      status: { notIn: ['rejected', 'withdrawn'] },
    },
    select: {
      applicationNumber: true,
      status: true,
      submittedAt: true,
      entryType: true,
      rawPayload: true,
    },
    orderBy: { submittedAt: 'desc' },
  });
  let name = '';
  try {
    name = duplicate
      ? participantDisplayName(duplicate.entryType || 'athlete', JSON.parse(duplicate.rawPayload || '{}'))
      : '';
  } catch {}
  return ERR.DUPLICATE({
    applicationNumber: duplicate?.applicationNumber ?? null,
    status: duplicate?.status ?? null,
    submittedAt: duplicate?.submittedAt ?? null,
    participantName: name,
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 'applications', 12, 60_000);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }
    const data = asStringRecord(body);
    if (!data) throw ERR.VALIDATION(null, 'Некорректный запрос');

    const slug = str(data.competitionId);
    const entryType = str(data.entryType);
    const payload = asStringRecord(data.participant);
    if (!slug || !payload || !['athlete', 'team'].includes(entryType)) {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    // ---- competition exists (cheap pre-check, real checks are under lock) --
    const competition = await db.competition.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, shortName: true, dateLabel: true, location: true },
    });
    if (!competition) throw ERR.NOT_FOUND('Турнир не найден');

    const fieldErrors =
      entryType === 'athlete' ? validateAthlete(payload) : validateTeam(payload);
    if (fieldErrors.length) {
      throw ERR.VALIDATION(fieldErrors, 'Проверьте правильность заполнения формы');
    }

    const contactEmail = normalizeEmail(str(payload.email));
    const now = new Date();
    const accessToken = randomBytes(24).toString('hex');

    // STAGE 5: заявка, поданная авторизованным спортсменом со СВОИМ e-mail,
    // сразу привязывается к аккаунту — кабинет видит её без claiming.
    const sessionUser = await getCurrentUser();
    const ownerUserId =
      sessionUser && sessionUser.email === contactEmail ? sessionUser.id : null;

    // ---- 2. one serialized transaction per competition --------------------
    let created;
    try {
      created = await db.$transaction(
        async (tx) => {
          // 2a. lock the competition row — serializes concurrent submissions
          //     for this competition (PostgreSQL SELECT ... FOR UPDATE).
          const locked = (await tx.$queryRaw(
            `SELECT "id", "status", "entryType", "maxEntries", "registrationOpenAt", "registrationCloseAt" FROM "competitions" WHERE "id" = $1 FOR UPDATE`,
            [competition.id]
          )) as LockedCompetitionRow[];
          const comp = locked[0];
          if (!comp) throw ERR.NOT_FOUND('Турнир не найден');

          // 2b. registration open RIGHT NOW — re-checked under the lock
          if (comp.status !== 'registration_open') throw ERR.REGISTRATION_CLOSED();
          if (comp.registrationOpenAt && now < comp.registrationOpenAt) {
            throw ERR.REGISTRATION_CLOSED();
          }
          if (comp.registrationCloseAt && now > comp.registrationCloseAt) {
            throw ERR.REGISTRATION_CLOSED();
          }
          if (comp.entryType === 'individual' && entryType === 'team') {
            throw ERR.VALIDATION({ entryType: 'Этот турнир проводится только в личном зачёте' });
          }
          if (comp.entryType === 'team' && entryType === 'athlete') {
            throw ERR.VALIDATION({ entryType: 'Этот турнир проводится только в экипажном зачёте' });
          }

          // 2c. seat limit — counted inside the same transaction that inserts
          if (comp.maxEntries > 0) {
            const active = await tx.application.count({
              where: { competitionId: comp.id, status: { in: ACTIVE_STATUSES } },
            });
            if (active >= comp.maxEntries) throw ERR.REGISTRATION_CLOSED();
          }

          // 2d. duplicate check — under the same lock
          const duplicate = await tx.application.findFirst({
            where: {
              competitionId: comp.id,
              contactEmail,
              status: { notIn: ['rejected', 'withdrawn'] },
            },
            select: { id: true },
          });
          if (duplicate) throw new DuplicateDetected();

          // 2e-1. server-generated unique number NOVA-YYYY-NNNNNN
          const year = now.getFullYear();
          const key = `application_number:${year}`;
          const counter = await tx.counter.upsert({
            where: { key },
            update: { value: { increment: 1 } },
            create: { key, value: 1 },
          });
          const applicationNumber = `NOVA-${year}-${String(counter.value).padStart(6, '0')}`;

          // 2e-2. athletes / team
          const participantIds: { athleteId: string; role: string }[] = [];
          let teamId: string | null = null;

          if (entryType === 'athlete') {
            const existing = await tx.athlete.findFirst({
              where: { email: contactEmail },
              select: { id: true },
            });
            const birth = str(payload.birthdate) ? new Date(str(payload.birthdate)) : null;
            const athleteData = {
              firstName: str(payload.firstname),
              lastName: str(payload.lastname),
              middleName: str(payload.middlename) || null,
              displayName: participantDisplayName('athlete', payload),
              birthDate: birth,
              phone: str(payload.phone),
              email: contactEmail,
              region: str(payload.region),
              city: str(payload.city),
              club: str(payload.club) || null,
              sportsCategory: str(payload.qualification),
            };
            const athlete = existing
              ? await tx.athlete.update({ where: { id: existing.id }, data: athleteData })
              : await tx.athlete.create({ data: athleteData });
            participantIds.push({ athleteId: athlete.id, role: 'solo' });
          } else {
            const teamName = str(payload.name);
            const existingTeam = await tx.team.findFirst({
              where: { name: teamName, region: str(payload.region) },
              select: { id: true },
            });
            const team = existingTeam
              ? await tx.team.update({
                  where: { id: existingTeam.id },
                  data: { club: str(payload.club) || null },
                })
              : await tx.team.create({
                  data: { name: teamName, region: str(payload.region), club: str(payload.club) || null },
                });
            teamId = team.id;

            const roster: string[] = Array.isArray(payload.roster)
              ? payload.roster.map((r: unknown) => str(r)).filter(Boolean)
              : [];
            for (let i = 0; i < roster.length; i++) {
              const parts = splitFullName(roster[i]);
              const athlete = await tx.athlete.create({
                data: {
                  lastName: parts.lastName,
                  firstName: parts.firstName,
                  middleName: parts.middleName,
                  displayName: roster[i],
                  region: str(payload.region),
                  city: str(payload.city),
                  club: str(payload.club) || null,
                },
              });
              participantIds.push({ athleteId: athlete.id, role: i === 0 ? 'captain' : 'member' });
            }
          }

          // 2e-3. application + participants + status history
          return tx.application.create({
            data: {
              applicationNumber,
              competitionId: comp.id,
              entryType,
              status: 'submitted',
              contactEmail,
              contactPhone: str(payload.phone),
              accessToken,
              teamId,
              userId: ownerUserId,
              rawPayload: JSON.stringify(payload),
              notes: str(payload.notes),
              source: 'web',
              submittedAt: now,
              participants: {
                create: participantIds.map((p) => ({ athleteId: p.athleteId, role: p.role })),
              },
              statusHistory: {
                create: [{ oldStatus: null, newStatus: 'submitted', comment: 'Заявка подана через сайт' }],
              },
            },
            include: { participants: true },
          } as any);
        },
        { timeout: 15_000 }
      );
    } catch (e) {
      // 2d. duplicate found under the lock — tx is already rolled back here,
      // so querying the details needs no extra pool connection.
      if (e instanceof DuplicateDetected) {
        throw await duplicateError(competition.id, contactEmail);
      }
          // 2d-backstop: the partial unique index is the hard DB guarantee.
          // The FOR UPDATE lock already serializes same-competition submissions,
          // so this only fires for direct-DB writes bypassing the API.
          if (
            typeof e === 'object' &&
            e !== null &&
            'code' in e &&
            (e as any).code === 'P2002' &&
            String((e as any).meta?.target ?? '').includes('applications_active_contact_uniq')
          ) {
            throw await duplicateError(competition.id, contactEmail);
          }
      throw e;
    }

    // ---- 3. confirmation ---------------------------------------------------
    // STAGE 6 §1.3 — уведомление «заявка принята» владельцу аккаунта
    // (гостевые заявки без аккаунта не уведомляем — адрес не подтверждён).
    if (created.userId && sessionUser) {
      sendStatusUpdate({
        userId: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        applicationId: created.id,
        applicationNumber: created.applicationNumber || '',
        competitionName: competition.name || competition.slug,
        status: 'submitted',
        statusLabel: 'Заявка принята',
      }).catch((e) => console.error('[applications] notify failed:', e?.message));
    }

    return Response.json(
      {
        application: {
          applicationNumber: created.applicationNumber,
          accessToken,
          status: created.status,
          entryType: created.entryType,
          submittedAt: created.submittedAt,
          participantName: participantDisplayName(entryType, payload),
          competition: {
            slug: competition.slug,
            title: competition.name,
            shortTitle: competition.shortName || competition.name,
            dateLabel: competition.dateLabel,
            place: competition.location,
          },
        },
      },
      { status: 201 }
    );
  });
}
