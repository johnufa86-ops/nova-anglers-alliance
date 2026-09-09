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
    .replace(/^-+|-+$/g, '') || `news-${Date.now()}`;
}

export async function GET() {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);

    const articles = await db.newsArticle.findMany({
      orderBy: { publishedAt: 'desc' },
    });

    return NextResponse.json({ articles });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 'admin-news', 30, 60_000);
    await requireStaff(['admin', 'organizer']);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const title = String(body?.title || '').trim();
    if (!title) throw ERR.VALIDATION({ title: 'Укажите заголовок статьи' });

    let slug = String(body?.slug || '').trim();
    if (!slug) slug = slugify(title);

    // ensure slug uniqueness
    const existing = await db.newsArticle.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const category = String(body?.category || 'Новости').trim();
    const excerpt = String(body?.excerpt || '').trim();
    const articleBody = String(body?.body || '').trim();
    const coverImage = String(body?.coverImage || '').trim();
    const isPublished = Boolean(body?.isPublished ?? true);
    const publishedAt = body?.publishedAt ? new Date(body.publishedAt) : new Date();

    const created = await db.newsArticle.create({
      data: {
        slug,
        title,
        category,
        excerpt,
        body: articleBody,
        coverImage,
        isPublished,
        publishedAt,
      },
    });

    return NextResponse.json({ article: created }, { status: 201 });
  });
}
