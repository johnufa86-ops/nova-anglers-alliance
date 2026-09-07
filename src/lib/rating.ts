/**
 * STAGE 6 §3 — глобальный рейтинг NOVA.
 *
 * Источник — те же протоколы (competitions.content.results) завершённых
 * и идущих соревнований, что и в «цифровой спортивной книжке» спортсмена
 * (src/lib/cabinet.ts): заявка должна быть approved. Сопоставление строк
 * протокола — по ФИО (без учёта порядка слов) или названию экипажа.
 *
 * ⚠ ВАЖНО: раздел §3 «РЕЙТИНГ» в полученном ТЗ отсутствует (текст
 * обрывается после модели Payment §2.2). Реализован минимальный
 * жизнеспособный контур: публичный список лидеров спортсменов и экипажей
 * (GET /api/rating, без PII) + подключение реальных данных на страницу
 * /rating.html. После уточнения ТЗ §3 (снапшоты, коэффициенты, зоны,
 * ручные корректировки) контур расширяется без изменения модели данных.
 */

import { db } from '@/lib/db';
import { normalizeName, parseNovaPoints, samePersonName } from '@/lib/cabinet';

export interface RatingEntry {
  id: string; // athleteId | teamId
  name: string;
  region: string;
  points: number;
  competitions: number;
}

function parseResults(content: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(content || '{}');
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [];
  }
}

// ── кэш рейтинга (5 минут) ──
const RATING_CACHE_TTL_MS = 5 * 60 * 1000;
type CachedRating = {
  data: { updatedAt: string; athletes: RatingEntry[]; teams: RatingEntry[] };
  expiresAt: number;
};
let globalRatingCache: CachedRating | null = null;

type AggregatedCache = {
  data: any;
  expiresAt: number;
  key: string;
};
let aggregatedCache: AggregatedCache | null = null;

export function clearRatingCache() {
  globalRatingCache = null;
  aggregatedCache = null;
}

export function getRatingCacheStats() {
  return {
    hasGlobal: !!globalRatingCache,
    globalExpiresIn: globalRatingCache ? Math.max(0, globalRatingCache.expiresAt - Date.now()) : 0,
    hasAggregated: !!aggregatedCache,
    aggregatedKey: aggregatedCache?.key || null,
  };
}

export async function computeGlobalRating(opts?: { force?: boolean }): Promise<{
  updatedAt: string;
  athletes: RatingEntry[];
  teams: RatingEntry[];
}> {
  if (!opts?.force && globalRatingCache && globalRatingCache.expiresAt > Date.now()) {
    return globalRatingCache.data;
  }
  const apps = await db.application.findMany({
    where: { status: 'approved' },
    select: {
      id: true,
      teamId: true,
      team: { select: { id: true, name: true, region: true } },
      competition: { select: { id: true, status: true, content: true } },
      participants: {
        include: { athlete: { select: { id: true, displayName: true, region: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const athletes = new Map<string, RatingEntry>();
  const teams = new Map<string, RatingEntry>();

  const bump = (map: Map<string, RatingEntry>, id: string, name: string, region: string, points: number) => {
    const cur = map.get(id);
    if (!cur) {
      map.set(id, { id, name, region, points, competitions: 0 });
      return;
    }
    cur.points += points;
    if (name) cur.name = name;
    if (region) cur.region = region;
  };

  for (const app of apps) {
    const comp = app.competition;
    if (!['completed', 'in_progress'].includes(comp.status)) continue;

    const results = parseResults(comp.content || '{}');
    const ownAthletes = app.participants.map((p) => p.athlete);
    const teamName = app.team?.name || null;

    for (let i = 0; i < results.length; i++) {
      const row = results[i] as Record<string, unknown>;
      const points = parseNovaPoints(row.novaPoints as never);

      for (const ath of ownAthletes) {
        const rowName = String(row.athleteName ?? '');
        if (rowName && samePersonName(rowName, ath.displayName || '')) {
          bump(athletes, ath.id, ath.displayName || '', ath.region || '', points);
        }
      }
      if (teamName && app.team) {
        const rowTeam = String(row.teamName ?? '');
        if (rowTeam && normalizeName(rowTeam).includes(normalizeName(teamName))) {
          bump(teams, app.team.id, app.team.name, app.team.region || '', points);
        }
      }
    }

    // старт зачётен даже без строки протокола — запись появляется с 0 очков
    for (const ath of ownAthletes) {
      if (!athletes.has(ath.id)) {
        athletes.set(ath.id, { id: ath.id, name: ath.displayName || '', region: ath.region || '', points: 0, competitions: 0 });
      }
    }
    if (app.team && !teams.has(app.team.id)) {
      teams.set(app.team.id, { id: app.team.id, name: app.team.name, region: app.team.region || '', points: 0, competitions: 0 });
    }
  }

  // зачётных стартов = подтверждённых заявок на завершённые/идущие турниры
  const countCompetitions = async (map: Map<string, RatingEntry>, kind: 'athlete' | 'team') => {
    for (const entry of map.values()) {
      entry.competitions = await db.application.count({
        where: {
          status: 'approved',
          ...(kind === 'team' ? { teamId: entry.id } : { participants: { some: { athleteId: entry.id } } }),
          competition: { status: { in: ['completed', 'in_progress'] } },
        },
      });
    }
  };
  await countCompetitions(athletes, 'athlete');
  await countCompetitions(teams, 'team');

  const sortDesc = (a: RatingEntry, b: RatingEntry) => b.points - a.points || b.competitions - a.competitions;

  const result = {
    updatedAt: new Date().toISOString(),
    athletes: [...athletes.values()].sort(sortDesc),
    teams: [...teams.values()].sort(sortDesc),
  };

  globalRatingCache = {
    data: result,
    expiresAt: Date.now() + RATING_CACHE_TTL_MS,
  };

  return result;
}

// Кэшированный агрегат для /api/rating (season+discipline+search)
export async function getCachedAggregatedRating(
  key: string,
  fetcher: () => Promise<any>,
  ttlMs: number = RATING_CACHE_TTL_MS
): Promise<any> {
  if (aggregatedCache && aggregatedCache.key === key && aggregatedCache.expiresAt > Date.now()) {
    return aggregatedCache.data;
  }
  const data = await fetcher();
  aggregatedCache = { data, expiresAt: Date.now() + ttlMs, key };
  return data;
}
