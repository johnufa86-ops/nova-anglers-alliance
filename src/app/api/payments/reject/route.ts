import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();

    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 }
      );
    }

    const payment = await (db as any).payment.update({
      where: { applicationId },
      data: {
        status: 'pending',
        proofStatus: 'rejected',
        proofFileUrl: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Чек отклонён',
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    return NextResponse.json(
      { error: 'Failed to reject payment' },
      { status: 500 }
    );
  }
}