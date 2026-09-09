import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { DEFAULT_CONTACTS_SETTINGS, DEFAULT_FOOTER_SETTINGS } from '@/lib/content';

export async function GET() {
  return handle(async () => {
    const row = await db.siteSetting.findUnique({
      where: { key: 'contacts_content' },
    });

    const defaults = { ...DEFAULT_CONTACTS_SETTINGS, ...DEFAULT_FOOTER_SETTINGS };

    if (!row || !row.value) {
      return NextResponse.json({ settings: defaults });
    }

    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json({
        settings: { ...defaults, ...parsed },
      });
    } catch {
      return NextResponse.json({ settings: defaults });
    }
  });
}
