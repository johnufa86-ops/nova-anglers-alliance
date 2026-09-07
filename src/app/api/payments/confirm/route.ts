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
        status: 'paid',
        proofStatus: 'confirmed',
        confirmedAt: new Date(),
      },
    });

    // Также обновляем статус заявки
    await (db as any).application.update({
      where: { id: applicationId },
      data: {
        status: 'approved',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Оплата подтверждена',
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}