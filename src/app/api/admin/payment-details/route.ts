import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { validateBankDetails } from '@/lib/bank-validation';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'organizer'].includes(user.role.toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get('competitionId') || null;

  const details = await db.paymentDetails.findFirst({
    where: { competitionId },
  });
  return NextResponse.json({ data: details });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'organizer'].includes(user.role.toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
  }

  const validation = validateBankDetails(body);
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
  }

  const { competitionId, bankName, accountNumber, bik, inn, recipientName, paymentPurpose } = body;
  const targetCompetitionId = competitionId || null;

  const existing = await db.paymentDetails.findFirst({
    where: { competitionId: targetCompetitionId },
  });

  let saved;
  if (existing) {
    saved = await db.paymentDetails.update({
      where: { id: existing.id },
      data: {
        bankName: String(bankName || '').trim(),
        accountNumber: String(accountNumber || '').trim(),
        bik: String(bik || '').trim(),
        inn: inn ? String(inn).trim() : null,
        recipientName: String(recipientName || '').trim(),
        paymentPurpose: String(paymentPurpose || '').trim(),
      },
    });
  } else {
    saved = await db.paymentDetails.create({
      data: {
        competitionId: targetCompetitionId,
        bankName: String(bankName || '').trim(),
        accountNumber: String(accountNumber || '').trim(),
        bik: String(bik || '').trim(),
        inn: inn ? String(inn).trim() : null,
        recipientName: String(recipientName || '').trim(),
        paymentPurpose: String(paymentPurpose || '').trim(),
      },
    });
  }

  return NextResponse.json({ ok: true, data: saved });
}
