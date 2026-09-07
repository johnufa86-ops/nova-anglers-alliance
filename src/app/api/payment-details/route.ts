import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const details = await (db as any).paymentDetails.findFirst({
      where: { competitionId: null },
    });

    if (!details) {
      return NextResponse.json({
        bankName: 'ПАО СБЕРБАНК',
        accountNumber: '40802810000000000000',
        bik: '044525225',
        inn: '7701234567',
        recipientName: 'Федерация рыболовного спорта',
        paymentPurpose: 'Целевой взнос за участие в турнире',
      });
    }

    return NextResponse.json(details);
  } catch (error) {
    console.error('Error fetching payment details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment details' },
      { status: 500 }
    );
  }
}