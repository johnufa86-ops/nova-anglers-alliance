import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireStaff } from '@/lib/auth';
import { DEFAULT_BLOCKS_SETTINGS } from '@/lib/content';

export async function GET() {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);

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

export async function PUT(req: Request) {
  return handle(async () => {
    rateLimit(req, 'admin-blocks', 30, 60_000);
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

    const merged = { ...DEFAULT_BLOCKS_SETTINGS } as any;
    for (const key of Object.keys(DEFAULT_BLOCKS_SETTINGS) as (keyof typeof DEFAULT_BLOCKS_SETTINGS)[]) {
      if (typeof DEFAULT_BLOCKS_SETTINGS[key] === 'boolean') {
        merged[key] = Boolean(payload[key] ?? DEFAULT_BLOCKS_SETTINGS[key]);
      } else {
        merged[key] = String(payload[key] ?? DEFAULT_BLOCKS_SETTINGS[key]).trim();
      }
    }

    const row = await db.siteSetting.upsert({
      where: { key: 'page_blocks' },
      update: {
        value: JSON.stringify(merged),
      },
      create: {
        key: 'page_blocks',
        value: JSON.stringify(merged),
      },
    });

    return NextResponse.json({
      ok: true,
      settings: JSON.parse(row.value),
    });
  });
}
