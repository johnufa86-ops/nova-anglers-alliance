import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireStaff } from '@/lib/auth';
import { DEFAULT_HOME_SETTINGS } from '@/lib/content';

export async function GET() {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);

    const row = await db.siteSetting.findUnique({
      where: { key: 'home_content' },
    });

    if (!row || !row.value) {
      return NextResponse.json({ settings: DEFAULT_HOME_SETTINGS });
    }

    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json({
        settings: { ...DEFAULT_HOME_SETTINGS, ...parsed },
      });
    } catch {
      return NextResponse.json({ settings: DEFAULT_HOME_SETTINGS });
    }
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    rateLimit(req, 'admin-content', 30, 60_000);
    await requireStaff(['admin', 'organizer']);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const payload = body?.settings || body;
    if (!payload || typeof payload !== 'object') {
      throw ERR.VALIDATION(null, 'Данные не переданы');
    }

    const newSettings = {
      eyebrow: String(payload.eyebrow ?? DEFAULT_HOME_SETTINGS.eyebrow).trim(),
      title: String(payload.title ?? DEFAULT_HOME_SETTINGS.title).trim(),
      titleAccent: String(payload.titleAccent ?? DEFAULT_HOME_SETTINGS.titleAccent).trim(),
      sub: String(payload.sub ?? DEFAULT_HOME_SETTINGS.sub).trim(),
      ctaPrimaryText: String(payload.ctaPrimaryText ?? DEFAULT_HOME_SETTINGS.ctaPrimaryText).trim(),
      ctaPrimaryUrl: String(payload.ctaPrimaryUrl ?? DEFAULT_HOME_SETTINGS.ctaPrimaryUrl).trim(),
      ctaSecondaryText: String(payload.ctaSecondaryText ?? DEFAULT_HOME_SETTINGS.ctaSecondaryText).trim(),
      ctaSecondaryUrl: String(payload.ctaSecondaryUrl ?? DEFAULT_HOME_SETTINGS.ctaSecondaryUrl).trim(),
      statAthletes: String(payload.statAthletes ?? DEFAULT_HOME_SETTINGS.statAthletes).trim(),
      statCrews: String(payload.statCrews ?? DEFAULT_HOME_SETTINGS.statCrews).trim(),
      statTournaments: String(payload.statTournaments ?? DEFAULT_HOME_SETTINGS.statTournaments).trim(),
      statRegions: String(payload.statRegions ?? DEFAULT_HOME_SETTINGS.statRegions).trim(),
    };

    const row = await db.siteSetting.upsert({
      where: { key: 'home_content' },
      update: {
        value: JSON.stringify(newSettings),
      },
      create: {
        key: 'home_content',
        value: JSON.stringify(newSettings),
      },
    });

    return NextResponse.json({
      ok: true,
      settings: JSON.parse(row.value),
    });
  });
}
