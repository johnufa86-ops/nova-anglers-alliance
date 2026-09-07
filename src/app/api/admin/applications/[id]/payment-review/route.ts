import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email/send';
import { paymentProofConfirmedEmail, paymentProofRejectedEmail } from '@/lib/email/templates';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const app = await (db as any).application.findUnique({
    where: { id: applicationId },
    include: {
      payment: true,
      athlete: true,
      competition: { include: { organizerAssignments: true } },
    },
  });

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const isAssigned = app.competition?.organizerAssignments?.some((a: any) => a.userId === user.id);
  const isAdmin = user.role === 'admin';
  if (!isAssigned && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, rejectReason } = await req.json();
  const athleteName = `${app.athlete?.firstName || ''} ${app.athlete?.lastName || ''}`.trim() || 'Спортсмен';
  const competitionTitle = app.competition?.title || 'Соревнование';
  const athleteEmail = app.athlete?.email;

  if (action === 'confirm') {
    await (db as any).payment.update({
      where: { applicationId },
      data: {
        proofStatus: 'confirmed',
        status: 'paid',
        confirmedById: user.id,
        confirmedAt: new Date(),
      },
    });

    await (db as any).application.update({
      where: { id: applicationId },
      data: { status: 'approved' },
    });

    if (athleteEmail) {
      try {
        const mail = paymentProofConfirmedEmail({ athleteName, competitionTitle });
        await sendEmail({ to: athleteEmail, subject: mail.subject, html: mail.html });
      } catch (err) {
        console.error('[Email Error]', err);
      }
    }
    return NextResponse.json({ success: true, status: 'confirmed' });
  } else if (action === 'reject') {
    if (!rejectReason || !rejectReason.trim()) {
      return NextResponse.json({ error: 'Комментарий обязателен при отклонении чека' }, { status: 400 });
    }

    await (db as any).payment.update({
      where: { applicationId },
      data: {
        proofStatus: 'rejected',
        rejectReason: rejectReason.trim(),
        status: 'failed',
      },
    });

    if (athleteEmail) {
      try {
        const mail = paymentProofRejectedEmail({
          athleteName,
          competitionTitle,
          reason: rejectReason.trim(),
        });
        await sendEmail({ to: athleteEmail, subject: mail.subject, html: mail.html });
      } catch (err) {
        console.error('[Email Error]', err);
      }
    }
    return NextResponse.json({ success: true, status: 'rejected' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
