import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    if (!id) throw ERR.VALIDATION(null, 'ID новости не указан');

    const article = await db.newsArticle.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        isPublished: true,
      },
    });

    if (!article) throw ERR.NOT_FOUND('Новость не найдена');

    return NextResponse.json({ article });
  });
}
