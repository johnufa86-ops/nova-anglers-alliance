// @ts-nocheck
import { db } from '@/lib/db';
import { handle } from '@/lib/api';
import { requireStaff } from '@/lib/auth';
import { lazyExpireDocuments, serializeDocument } from '@/lib/cabinet';

/**
 * GET /api/admin/documents?status=pending&userId=
 * Документы спортсменов для проверки (кабинет организатора).
 * Просмотр — весь staff; смена статусов — admin/organizer (PATCH /:id).
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff();

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';
    const userId = url.searchParams.get('userId') || '';

    const where: any = {};
    if (status && ['pending', 'approved', 'rejected', 'expired'].includes(status)) {
      where.status = status;
    }
    if (userId) where.userId = userId;

    const docs = await db.document.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, email: true, name: true,
            athlete: { select: { displayName: true, region: true, city: true, club: true, sportsCategory: true } },
          },
        },
      },
      orderBy: [{ uploadedAt: 'desc' }],
      take: 200,
    });

    // счётчики для бейджей + глобальное ленивое истечение просроченных справок
    await lazyExpireDocuments();
    const counts = await db.document.groupBy({ by: ['status'], _count: true });

    return Response.json({
      documents: docs.map((d) => ({
        ...serializeDocument(d),
        user: d.user
          ? {
              id: d.user.id,
              email: d.user.email,
              name: d.user.name,
              athlete: d.user.athlete,
            }
          : null,
      })),
      counts: counts.reduce(
        (acc, g) => ({ ...acc, [g.status]: g._count }),
        {} as Record<string, number>
      ),
    });
  });
}
