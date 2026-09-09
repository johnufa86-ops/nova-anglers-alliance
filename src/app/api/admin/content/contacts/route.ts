import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireStaff } from '@/lib/auth';
import { DEFAULT_CONTACTS_SETTINGS, DEFAULT_FOOTER_SETTINGS } from '@/lib/content';

const DEFAULTS = { ...DEFAULT_CONTACTS_SETTINGS, ...DEFAULT_FOOTER_SETTINGS };

export async function GET() {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);

    const row = await db.siteSetting.findUnique({
      where: { key: 'contacts_content' },
    });

    if (!row || !row.value) {
      return NextResponse.json({ settings: DEFAULTS });
    }

    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json({
        settings: { ...DEFAULTS, ...parsed },
      });
    } catch {
      return NextResponse.json({ settings: DEFAULTS });
    }
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    rateLimit(req, 'admin-contacts', 30, 60_000);
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
      phone: String(payload.phone ?? DEFAULTS.phone).trim(),
      emailGeneral: String(payload.emailGeneral ?? DEFAULTS.emailGeneral).trim(),
      emailPartners: String(payload.emailPartners ?? DEFAULTS.emailPartners).trim(),
      emailMedia: String(payload.emailMedia ?? DEFAULTS.emailMedia).trim(),
      address: String(payload.address ?? DEFAULTS.address).trim(),
      workingHours: String(payload.workingHours ?? DEFAULTS.workingHours).trim(),
      telegramUrl: String(payload.telegramUrl ?? DEFAULTS.telegramUrl).trim(),
      vkUrl: String(payload.vkUrl ?? DEFAULTS.vkUrl).trim(),
      youtubeUrl: String(payload.youtubeUrl ?? DEFAULTS.youtubeUrl).trim(),
      brandDesc: String(payload.brandDesc ?? DEFAULTS.brandDesc).trim(),
      copyright: String(payload.copyright ?? DEFAULTS.copyright).trim(),
    };

    const row = await db.siteSetting.upsert({
      where: { key: 'contacts_content' },
      update: {
        value: JSON.stringify(newSettings),
      },
      create: {
        key: 'contacts_content',
        value: JSON.stringify(newSettings),
      },
    });

    return NextResponse.json({
      ok: true,
      settings: JSON.parse(row.value),
    });
  });
}
