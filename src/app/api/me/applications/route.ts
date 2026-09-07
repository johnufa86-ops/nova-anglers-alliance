import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Временное решение: возвращаем все заявки без проверки авторизации
    // В продакшене здесь должна быть проверка токена пользователя
    
    const applications = await (db as any).application.findMany({
      include: {
        competition: {
          select: {
            id: true,
            title: true,
            slug: true,
            date: true,
            fee: true,
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            method: true,
            proofStatus: true,
            proofFileUrl: true,
            amount: true,
          },
        },
        athlete: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ 
      applications: applications,
      data: applications,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}