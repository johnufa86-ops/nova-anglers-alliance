import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireStaff } from '@/lib/auth';

function slugify(text: string): string {
  const cyrToLat: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return text
    .toLowerCase()
    .split('')
    .map((c) => cyrToLat[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `tournament-${Date.now()}`;
}

export async function GET() {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);

    const competitions = await db.competition.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: { applications: true, results: true },
        },
      },
    });

    return NextResponse.json({ competitions });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 'admin-competitions', 30, 60_000);
    await requireStaff(['admin', 'organizer']);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const title = String(body?.title || body?.name || '').trim();
    if (!title) throw ERR.VALIDATION({ title: 'Укажите название соревнования' });

    let slug = String(body?.slug || '').trim();
    if (!slug) slug = slugify(title);

    const existing = await db.competition.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const shortTitle = String(body?.shortTitle || body?.shortName || title).trim();
    const location = String(body?.location || body?.place || '').trim();
    const region = String(body?.region || '').trim();
    const discipline = String(body?.discipline || 'spinning').trim();
    const disciplineLabel = String(body?.disciplineLabel || 'Спиннинг с лодок').trim();
    const status = String(body?.status || 'upcoming').trim();
    const prizeFund = String(body?.prizeFund || '').trim();
    const noLimit = Boolean(body?.noLimit);
    const maxEntries = noLimit ? 0 : (parseInt(body?.maxEntries || body?.maxParticipants || '100', 10) || 0);
    const fee = parseFloat(body?.fee || body?.entryFee || '0') || 0;
    const description = String(body?.description || '').trim();
    const dateLabel = String(body?.dateLabel || '').trim();

    const startDate = body?.startDate ? new Date(body.startDate) : (body?.date ? new Date(body.date) : new Date());
    const endDate = body?.endDate ? new Date(body.endDate) : startDate;
    const registrationOpenAt = body?.registrationOpenAt ? new Date(body.registrationOpenAt) : null;
    const registrationCloseAt = body?.registrationCloseAt ? new Date(body.registrationCloseAt) : null;

    let contentObj: any = {};
    try {
      contentObj = typeof body?.content === 'object' ? (body.content || {}) : JSON.parse(body?.content || '{}');
    } catch {}
    if (noLimit) contentObj.noLimit = true;

    const created = await db.competition.create({
      data: {
        slug,
        title,
        name: title,
        shortName: shortTitle,
        description,
        discipline,
        disciplineLabel,
        location,
        region,
        status,
        date: startDate,
        startDate,
        endDate,
        dateLabel,
        registrationOpenAt,
        registrationCloseAt,
        maxParticipants: maxEntries,
        maxEntries,
        fee,
        entryFee: Math.round(fee),
        prizeFund,
        format: String(body?.format || '').trim(),
        entryType: String(body?.entryType || 'both').trim(),
        days: parseInt(body?.days || '1', 10) || 1,
        pointsMultiplier: String(body?.pointsMultiplier || '×1.0').trim(),
        organizer: String(body?.organizer || 'NOVA Anglers Alliance').trim(),
        contact: String(body?.contact || '').trim(),
        content: JSON.stringify(contentObj),
      },
    });

    return NextResponse.json({ competition: created }, { status: 201 });
  });
}
