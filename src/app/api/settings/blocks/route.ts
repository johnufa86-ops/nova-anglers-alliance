import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { DEFAULT_BLOCKS_SETTINGS } from '@/lib/content';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const row = await db.siteSetting.findUnique({
      where: { key: 'page_blocks' },
    });

    if (!row || !row.value) {
      return NextResponse.json({ settings: DEFAULT_BLOCKS_SETTINGS });
    }

    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json({
        settings: { ...DEFAULT_BLOCKS_SETTINGS, ...parsed },
      });
    } catch {
      return NextResponse.json({ settings: DEFAULT_BLOCKS_SETTINGS });
    }
  });
}
