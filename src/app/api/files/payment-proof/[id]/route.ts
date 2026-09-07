import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPrivateFileStream } from '@/lib/storage';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payment = await (db as any).payment.findUnique({
    where: { id: paymentId },
    include: {
      application: {
        include: {
          competition: { include: { organizerAssignments: true } },
        },
      },
    },
  });

  if (!payment || !payment.proofFileUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwner = payment.application.athleteId === user.id;
  const isAssigned = payment.application.competition?.organizerAssignments?.some(
    (a: any) => a.userId === user.id
  );
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAssigned && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const fileData = await getPrivateFileStream(payment.proofFileUrl);
  if (!fileData) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  return new NextResponse(fileData.stream, {
    headers: {
      'Content-Type': fileData.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="proof_${paymentId}"`,
    },
  });
}
