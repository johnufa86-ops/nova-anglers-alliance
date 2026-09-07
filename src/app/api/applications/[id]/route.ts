import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    const application = await (db as any).application.findUnique({
      where: { id: params.id },
      include: {
        athlete: {
          select: {
            firstName: true,
            lastName: true,
            city: true,
            club: true,
          },
        },
        competition: {
          select: {
            id: true,
            title: true,
            slug: true,
            date: true,
            fee: true,
          },
        },
        payment: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json(
      { error: 'Failed to fetch application' },
      { status: 500 }
    );
  }
}