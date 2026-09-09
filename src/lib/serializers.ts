/**
 * Serializers: DB rows → frontend shapes.
 *
 * The public competition shape intentionally mirrors the legacy
 * NOVA_DATA.competitions[] demo entries so the existing static pages
 * (competition.html, competitions.html, index.html) keep rendering
 * without redesign — while the numbers now come from the database.
 */

const STAGE_BY_STATUS: Record<string, string> = {
  draft: 'upcoming',
  upcoming: 'upcoming',
  registration_open: 'upcoming',
  registration_closed: 'upcoming',
  live: 'live',
  in_progress: 'live',
  finished: 'finished',
  completed: 'finished',
  archived: 'finished',
};

/** Registration state for cards/buttons, computed from status + dates. */
export function registrationState(c: {
  status: string;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
}): 'open' | 'soon' | 'closed' {
  const now = Date.now();
  if (c.status === 'registration_open' || c.status === 'upcoming') {
    const openFrom = c.registrationOpenAt ? c.registrationOpenAt.getTime() : 0;
    const openTo = c.registrationCloseAt ? c.registrationCloseAt.getTime() : Infinity;
    if (now < openFrom) return 'soon';
    if (now > openTo) return 'closed';
    return 'open';
  }
  if (c.status === 'draft' && c.registrationOpenAt && c.registrationOpenAt.getTime() > now) {
    return 'soon';
  }
  return 'closed';
}

export type CompetitionWithCounts = {
  slug: string;
  name: string;
  shortName: string;
  discipline: string;
  disciplineLabel: string;
  entryType: string;
  description: string;
  location: string;
  region: string;
  startDate: Date;
  endDate: Date;
  dateLabel: string;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  maxEntries: number;
  status: string;
  format: string;
  prizeFund: string;
  days: number;
  pointsMultiplier: string;
  organizer: string;
  contact: string;
  content: string;
  _count?: { applications: number };
};

/** Real registration pressure: active applications (incl. approved). */
export function activeCount(c: CompetitionWithCounts): number {
  // applications counted server-side in the route (by status groups)
  return (c as any)._activeCount ?? c._count?.applications ?? 0;
}

export function serializePublicCompetition(
  c: CompetitionWithCounts,
  counts: { active: number; approved: number }
) {
  let content: any = {};
  try {
    content = JSON.parse(c.content || '{}');
  } catch {}
  const pad = (n: number) => String(n).padStart(2, '0');
  const startRaw = (c as any).startDate || (c as any).date;
  const endRaw = (c as any).endDate || (c as any).date;
  const d = startRaw ? new Date(startRaw) : new Date();
  const e = endRaw ? new Date(endRaw) : d;
  const dateStartStr = isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateEndStr = isNaN(e.getTime()) ? '' : `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`;
  const title = (c as any).title || (c as any).name || 'Соревнование NOVA';
  const shortTitle = (c as any).shortName || (c as any).title || (c as any).name || 'NOVA CUP';

  return {
    id: c.slug,
    title,
    shortTitle,
    stage: STAGE_BY_STATUS[c.status] || 'upcoming',
    registration: registrationState(c),
    dateLabel: c.dateLabel || ((c as any).date ? new Date((c as any).date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''),
    dateStart: dateStartStr,
    dateEnd: dateEndStr,
    region: c.region || '',
    place: c.location || '',
    discipline: c.discipline || 'spinning',
    disciplineLabel: c.disciplineLabel || 'Спиннинг с лодок',
    format: c.format || '',
    entryType: c.entryType || 'both',
    organizer: c.organizer || 'NOVA Anglers Alliance',
    contact: c.contact,
    participants: counts.active,
    approvedCount: counts.approved,
    participantsLimit: c.maxEntries,
    prizeFund: c.prizeFund,
    days: c.days,
    pointsMultiplier: c.pointsMultiplier,
    description: c.description,
    regulations: content.regulations ?? [],
    documents: content.documents ?? [],
    media: content.media ?? [],
    results: content.results ?? [],
  };
}

/** What the public site may show about a confirmed participant. */
export function serializePublicParticipant(p: {
  id: string;
  role: string;
  application: {
    applicationNumber: string;
    entryType: string;
    status: string;
    team?: { name: string; region: string } | null;
  };
  athlete: {
    displayName: string;
    region: string;
    club?: string | null;
  };
}) {
  const isTeam = p.application.entryType === 'team';
  return {
    applicationNumber: p.application.applicationNumber,
    name: p.athlete.displayName,
    teamName: isTeam ? p.application.team?.name ?? null : p.athlete.club || null,
    region: p.athlete.region,
    role: p.role,
    status: p.application.status,
    // NOTE: no phone / email / birthdate here — organizer-only data
  };
}
