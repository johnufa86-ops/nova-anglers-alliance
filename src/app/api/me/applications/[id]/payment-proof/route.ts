import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPaymentConfig } from '@/lib/payments-config';
import { savePrivateFile } from '@/lib/storage';
import { checkRateLimit } from '@/lib/rate-limiter';
import { sendEmail } from '@/lib/email/send';
import { paymentProofReceivedEmail } from '@/lib/email/templates';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;
  const config = getPaymentConfig();
  if (!config.isBankTransferEnabled) {
    return NextResponse.json({ error: 'Bank transfer is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limitCheck = checkRateLimit(`proof_upload_${user.id}`, 5, 3600000);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: 'Превышен лимит загрузок чеков (не более 5 в час)' }, { status: 429 });
  }

  const app = await (db as any).application.findUnique({
    where: { id: applicationId },
    include: { payment: true, competition: true },
  });

  if (!app || app.athleteId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Файл не прикреплен' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Размер файла превышает лимит 5 МБ' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  if (!isJpg && !isPng && !isPdf) {
    return NextResponse.json({ error: 'Недопустимый формат. Допустимы только JPG, PNG и PDF' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'dat';
  const storedPath = await savePrivateFile({
    buffer,
    filename: `proof_${applicationId}_${Date.now()}.${ext}`,
    bucket: 'payment-proofs',
  });

  const updatedPayment = await (db as any).payment.upsert({
    where: { applicationId },
    update: {
      method: 'bank_transfer',
      proofFileUrl: storedPath,
      proofStatus: 'awaiting_review',
      rejectReason: null,
      status: 'pending',
    },
    create: {
      applicationId,
      amount: app.fee || 0,
      currency: 'RUB',
      method: 'bank_transfer',
      proofFileUrl: storedPath,
      proofStatus: 'awaiting_review',
      status: 'pending',
    },
  });

  try {
    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Спортсмен';
    const mail = paymentProofReceivedEmail({
      athleteName,
      competitionTitle: app.competition?.title || 'Соревнование',
    });
    await sendEmail({ to: user.email, subject: mail.subject, html: mail.html });
  } catch (err) {
    console.error('[Email Error]', err);
  }

  return NextResponse.json({ success: true, payment: updatedPayment });
}
