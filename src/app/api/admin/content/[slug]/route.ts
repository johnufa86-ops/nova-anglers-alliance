import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireStaff } from '@/lib/auth';
import { PAGE_DEFAULTS } from '@/lib/content';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    rateLimit(req, 'admin-content', 30, 60_000);
    await requireStaff(['admin', 'organizer']);
    const { slug } = await params;

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

    const defaults = PAGE_DEFAULTS[slug] || {};
    const merged = { ...defaults, ...payload };

    const row = await db.siteSetting.upsert({
      where: { key: `${slug}_content` },
      update: {
        value: JSON.stringify(merged),
      },
      create: {
        key: `${slug}_content`,
        value: JSON.stringify(merged),
      },
    });

    return NextResponse.json({
      ok: true,
      settings: JSON.parse(row.value),
    });
  });
}
