import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPaymentConfig } from '@/lib/payments-config';

export async function POST(req: NextRequest) {
  // Guard Этапа 6.5: Скрытие онлайн-эквайринга
  if (!getPaymentConfig().isOnlineEnabled) {
    return NextResponse.json({ error: 'Online payment disabled' }, { status: 503 });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { applicationId } = body;

  if (!applicationId) {
    return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
  }

  const app = await (db as any).application.findUnique({
    where: { id: applicationId },
    include: { payment: true, athlete: true },
  });

  if (!app || app.athlete.userId !== user.id) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (app.payment?.status === 'paid') {
    return NextResponse.json({ error: 'Already paid' }, { status: 400 });
  }

  const amount = app.fee || 1000;
  const payment = await (db as any).payment.upsert({
    where: { applicationId },
    update: {
      amount,
      method: 'online',
      status: 'pending',
    },
    create: {
      applicationId,
      amount,
      currency: 'RUB',
      method: 'online',
      status: 'pending',
    },
  });

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    amount,
    currency: 'RUB',
  });
}
