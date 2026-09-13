import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { DEFAULT_HOME_SETTINGS } from '@/lib/content';

export async function GET() {
  return handle(async () => {
    const [row, realAthletes, realComps, athleteRegions, compRegions] = await Promise.all([
      db.siteSetting.findUnique({
        where: { key: 'home_content' },
      }).catch(() => null),
      (db as any).athlete.count().catch(() => 0),
      db.competition.count().catch(() => 0),
      (db as any).athlete.findMany({ select: { region: true }, distinct: ['region'] }).catch(() => []),
      db.competition.findMany({ select: { region: true }, distinct: ['region'] }).catch(() => []),
    ]);

    const uniqueRegions = new Set([
      ...athleteRegions.map((r: any) => r.region?.trim()).filter(Boolean),
      ...compRegions.map((r: any) => r.region?.trim()).filter(Boolean),
    ]);

    let parsed: Record<string, any> = {};
    if (row && row.value) {
      try {
        parsed = JSON.parse(row.value);
      } catch {}
    }

    const merged = { ...DEFAULT_HOME_SETTINGS, ...parsed };

    // Dynamic auto-calculation: scales automatically when new athletes / comps / regions are registered
    const finalAthletes = Math.max(Number(merged.statAthletes || 0), realAthletes);
    const finalTournaments = Math.max(Number(merged.statTournaments || 0), realComps);
    const finalRegions = Math.max(Number(merged.statRegions || 0), uniqueRegions.size);

    return NextResponse.json({
      settings: {
        ...merged,
        statAthletes: String(finalAthletes),
        statTournaments: String(finalTournaments),
        statRegions: String(finalRegions),
      },
    });
  });
}
