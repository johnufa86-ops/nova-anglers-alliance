import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { lazyExpireApplications } from '@/lib/applications';

export async function GET(req: NextRequest) {
  try {
    await lazyExpireApplications();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const applications = await (db as any).application.findMany({
      where: {
        OR: [{ userId: user.id }, { athlete: { userId: user.id } }],
      },
      include: {
        competition: {
          select: {
            id: true,
            title: true,
            slug: true,
            date: true,
            fee: true,
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            method: true,
            proofStatus: true,
            proofFileUrl: true,
            amount: true,
          },
        },
        athlete: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ 
      applications: applications,
      data: applications,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}