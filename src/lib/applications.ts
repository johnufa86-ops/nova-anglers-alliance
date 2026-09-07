/**
 * Application domain rules shared by the API routes:
 * statuses, allowed transitions.
 */

export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'needs_changes',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  submitted: 'Подана',
  under_review: 'На проверке',
  approved: 'Подтверждена',
  needs_changes: 'Вернуть на доработку',
  rejected: 'Отклонена',
  withdrawn: 'Отозвана',
};

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  athlete: 'Спортсмен',
  team: 'Экипаж',
};

/**
 * Allowed status transitions (from → [to...]). Comment is mandatory for
 * needs_changes and rejected — enforced in the status route.
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_review', 'approved', 'needs_changes', 'rejected'],
  under_review: ['approved', 'needs_changes', 'rejected'],
  needs_changes: ['under_review', 'rejected'],
  approved: ['rejected'],
  rejected: ['under_review'],
  withdrawn: [],
};

/** Statuses that occupy a provisional/real seat in the competition. */
export const ACTIVE_STATUSES = ['submitted', 'under_review', 'needs_changes', 'approved'];

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

/**
 * Application numbers are generated server-side INSIDE the submission
 * transaction (see /api/applications) — the counter row is upserted with
 * an atomic increment, and the `applicationNumber` unique index is the
 * safety net. Do not generate numbers outside a transaction.
 */

/** 48 часов — таймаут для ленивого истечения заявок (ТЗ §2.5). */
export const APPLICATION_EXPIRE_HOURS = 48;
export const APPLICATION_EXPIRE_MS = APPLICATION_EXPIRE_HOURS * 3600_000;

/**
 * Ленивое истечение: заявки в статусах pending/submitted/under_review,
 * созданные более 48ч назад, помечаются как expired.
 * Вызывается при чтении списков, не требует крона.
 */
export async function lazyExpireApplications(): Promise<number> {
  try {
    const { db } = await import('@/lib/db');
    const cutoff = new Date(Date.now() - APPLICATION_EXPIRE_MS);
    const res = await db.application.updateMany({
      where: {
        status: { in: ['pending', 'submitted', 'under_review', 'draft'] },
        createdAt: { lt: cutoff },
      },
      data: { status: 'expired' },
    });
    if (res.count > 0) {
      console.log(`[applications] lazy-expired ${res.count} applications older than ${APPLICATION_EXPIRE_HOURS}h`);
    }
    return res.count;
  } catch (e) {
    console.warn('[applications] lazyExpire failed', (e as any)?.message);
    return 0;
  }
}

/** Public display name for an entry (athlete or team application). */
export function participantDisplayName(entryType: string, payload: any): string {
  if (entryType === 'team') return payload?.name || 'Экипаж';
  return [payload?.lastname, payload?.firstname, payload?.middlename]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Split a free-text roster line ("Иванов Иван Иванович") into parts. */
export function splitFullName(full: string): {
  lastName: string;
  firstName: string;
  middleName: string | null;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: '', firstName: '', middleName: null };
  if (parts.length === 1) return { lastName: parts[0], firstName: '—', middleName: null };
  return {
    lastName: parts[0],
    firstName: parts[1],
    middleName: parts.slice(2).join(' ') || null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
