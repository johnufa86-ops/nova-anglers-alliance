import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle } from '@/lib/api';

export async function GET(req: Request) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 50) : undefined;

    const where: any = { isPublished: true };
    if (category && category !== 'all') {
      where.category = category;
    }

    const rows = await db.newsArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({ news: rows });
  });
}
