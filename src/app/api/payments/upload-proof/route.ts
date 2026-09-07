import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const applicationId = formData.get('applicationId') as string;

    if (!file || !applicationId) {
      return NextResponse.json(
        { error: 'File and applicationId are required' },
        { status: 400 }
      );
    }

    // Проверка размера файла (макс 5 МБ)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Файл слишком большой. Максимум 5 МБ.' },
        { status: 400 }
      );
    }

    // Создаём папку для загрузок
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Генерируем уникальное имя файла
    const timestamp = Date.now();
    const fileName = `proof-${applicationId}-${timestamp}.${file.name.split('.').pop()}`;
    const filePath = join(uploadDir, fileName);

    // Сохраняем файл
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes) as any;
    await writeFile(filePath, buffer as any);

    // Обновляем платёж в базе
    const payment = await (db as any).payment.update({
      where: { applicationId },
      data: {
        proofFileUrl: `/uploads/${fileName}`,
        proofStatus: 'awaiting_review',
        status: 'pending',
        method: 'bank_transfer',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Чек успешно загружен',
      proofFileUrl: payment.proofFileUrl,
    });
  } catch (error) {
    console.error('Error uploading proof:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке файла' },
      { status: 500 }
    );
  }
}