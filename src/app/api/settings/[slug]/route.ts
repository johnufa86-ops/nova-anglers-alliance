import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { PAGE_DEFAULTS } from '@/lib/content';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await params;
    const defaults = PAGE_DEFAULTS[slug] || {};

    const row = await db.siteSetting.findUnique({
      where: { key: `${slug}_content` },
    }).catch(() => null);

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
