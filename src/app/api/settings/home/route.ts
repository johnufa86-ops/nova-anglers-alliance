import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { DEFAULT_HOME_SETTINGS } from '@/lib/content';

export async function GET() {
  return handle(async () => {
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
