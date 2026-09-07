import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { validateBankDetails } from '@/lib/bank-validation';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get('competitionId') || null;

  const details = await (db as any).paymentDetails.findFirst({
    where: { competitionId },
  });
  return NextResponse.json({ data: details });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBankDetails(body);
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
  }

  const { competitionId, bankName, accountNumber, bik, inn, recipientName, paymentPurpose } = body;
  const saved = await (db as any).paymentDetails.upsert({
    where: { competitionId: competitionId || null },
    update: { bankName, accountNumber, bik, inn, recipientName, paymentPurpose },
    create: { competitionId: competitionId || null, bankName, accountNumber, bik, inn, recipientName, paymentPurpose },
  });
  return NextResponse.json({ data: saved });
}
