import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { ERR } from '@/lib/api';

/**
 * Auth for the organizer dashboard AND the athlete cabinet (Stage 5).
 *
 * - passwords: scrypt with per-user salt (Node built-in, no external deps)
 * - sessions: opaque 48-hex tokens stored in the DB, delivered as an
 *   httpOnly cookie — the JS frontend can never read the token itself
 * - roles: admin (full) | organizer (assigned competitions) | viewer (read-only)
 *          athlete (личный кабинет спортсмена, Stage 5)
 */

export const SESSION_COOKIE = 'nova_session';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

export type Role = 'admin' | 'organizer' | 'viewer' | 'athlete';

export const STAFF_ROLES: Role[] = ['admin', 'organizer', 'viewer'];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// ------------------------------------------------------------
// passwords
// ------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(':');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64) as any;
    const expected = Buffer.from(hash, 'hex') as any;
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// sessions
// ------------------------------------------------------------

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = randomBytes(24).toString('hex');
  await db.session.create({
    data: {
      id: token,
      userId,
      userAgent: userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { id: token } });
}

/** Resolve the current user from the session cookie (or null). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { id: token } }).catch(() => {});
    return null;
  }
  const u = session.user;
  const rawRole = (u.role || '').toLowerCase();
  const role: Role = (['admin', 'organizer', 'viewer', 'athlete'].includes(rawRole) ? rawRole : 'athlete') as Role;
  return { id: u.id, email: u.email, name: u.name || u.email, role };
}

/**
 * Require an authenticated user with one of the allowed roles.
 * Throws clean ApiErrors that `handle()` converts to responses.
 */
export async function requireUser(allowed: Role[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw ERR.UNAUTHORIZED();
  if (!allowed.includes(user.role)) throw ERR.FORBIDDEN();
  return user;
}

/** Any authenticated account (athlete cabinet works for every role). */
export async function requireAnyUser(): Promise<AuthUser> {
  return requireUser(['admin', 'organizer', 'viewer', 'athlete']);
}

/** Staff only — athlete role is rejected (document review, exports…). */
export async function requireStaff(allowed: Role[] = ['admin', 'organizer', 'viewer']): Promise<AuthUser> {
  return requireUser(allowed);
}

// ------------------------------------------------------------
// organizer scoping — an `organizer` only sees assigned competitions,
// `admin` sees everything, `viewer` reads everything it is allowed to.
// ------------------------------------------------------------

/** Competition ids the user may administer (null = unrestricted / admin). */
export async function scopedCompetitionIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === 'admin') return null;
  if (user.role === 'organizer') {
    const rows = await db.organizerAssignment.findMany({
      where: { userId: user.id },
      select: { competitionId: true },
    });
    return rows.map((r) => r.competitionId);
  }
  // viewers read everything — enforced by role checks at each endpoint
  return null;
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
