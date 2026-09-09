import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR, rateLimit } from '@/lib/api';
import { requireStaff } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);
    const { id } = await params;

    const article = await db.newsArticle.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!article) throw ERR.NOT_FOUND('Статья не найдена');

    return NextResponse.json({ article });
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    rateLimit(req, 'admin-news', 30, 60_000);
    await requireStaff(['admin', 'organizer']);
    const { id } = await params;

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw ERR.VALIDATION(null, 'Некорректный запрос');
    }

    const article = await db.newsArticle.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!article) throw ERR.NOT_FOUND('Статья не найдена');

    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.excerpt !== undefined) data.excerpt = String(body.excerpt).trim();
    if (body.body !== undefined) data.body = String(body.body).trim();
    if (body.coverImage !== undefined) data.coverImage = String(body.coverImage).trim();
    if (body.isPublished !== undefined) data.isPublished = Boolean(body.isPublished);
    if (body.publishedAt !== undefined) data.publishedAt = new Date(body.publishedAt);
    if (body.slug !== undefined && body.slug.trim()) data.slug = String(body.slug).trim();

    const updated = await db.newsArticle.update({
      where: { id: article.id },
      data,
    });

    return NextResponse.json({ article: updated });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireStaff(['admin', 'organizer']);
    const { id } = await params;

    const article = await db.newsArticle.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!article) throw ERR.NOT_FOUND('Статья не найдена');

    await db.newsArticle.delete({ where: { id: article.id } });

    return NextResponse.json({ ok: true, deletedId: article.id });
  });
}
