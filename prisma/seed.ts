import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

// Resolve DATABASE_URL from .env if needed (same logic as src/lib/db.ts)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const envPath = path.join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (match) {
      const url = match[1].trim().replace(/^["']|["']$/g, '');
      if (url) process.env.DATABASE_URL = url;
    }
  }
}

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const db = prisma as any;

const DEMO_PDF_BASE64 = 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Cj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZAooRGVtbyBEb2N1bWVudCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoxIDAgb2JqCjw8L1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZwovUGFnZXMgMSAwIFIKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDI3MiAwMDAwMCBuIAowMDAwMDAwMzI5IDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDE0NiAwMDAwMCBuIAowMDAwMDAwMjAyIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2Ci9Sb290IDIgMCBSCj4+CnN0YXJ0eHJlZgozNzgKJSVFT0YK';

const DEMO_PDF = new Uint8Array(Buffer.from(DEMO_PDF_BASE64, 'base64'));

async function main() {
  console.log('🚀 Начинаю создание тестовых данных...');

  const passwordHash = await bcrypt.hash('pass123', 10);
  console.log('✅ Пароль захеширован');

  const admin = await db.user.upsert({
    where: { email: 'admin@nova.ru' },
    update: {},
    create: {
      email: 'admin@nova.ru',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  console.log('✅ Админ создан:', admin.email);

  const organizer = await db.user.upsert({
    where: { email: 'org@nova.ru' },
    update: {},
    create: {
      email: 'org@nova.ru',
      passwordHash,
      role: 'ORGANIZER',
      emailVerified: true,
    },
  });
  console.log('✅ Организатор создан:', organizer.email);

  const athleteUsers: any[] = [];

  const athleteData = [
    { email: 'athlete1@nova.ru', firstName: 'Иван', lastName: 'Петров', city: 'Москва', club: 'Спиннинг Про' },
    { email: 'athlete2@nova.ru', firstName: 'Пётр', lastName: 'Сидоров', city: 'Санкт-Петербург', club: 'Фидер Мастер' },
    { email: 'athlete3@nova.ru', firstName: 'Алексей', lastName: 'Иванов', city: 'Казань', club: 'Карп Клуб' },
  ];

  for (const data of athleteData) {
    const user = await db.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        passwordHash,
        role: 'ATHLETE',
        emailVerified: true,
      },
    });

    const athlete = await db.athlete.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        city: data.city,
        club: data.club,
        gender: 'male',
        sportsCategory: 'КМС',
      },
    });

    athleteUsers.push({ user, athlete });
    console.log('✅ Спортсмен создан:', data.email);
  }

  const competition = await db.competition.upsert({
    where: { slug: 'nova-cup-2026' },
    update: {},
    create: {
      slug: 'nova-cup-2026',
      title: 'Кубок Nova Anglers Alliance 2026',
      description: 'Главный турнир сезона по спиннинговой ловле',
      discipline: 'spinning',
      category: 'open',
      location: 'Московская область, озеро Сенеж',
      date: new Date('2026-10-15'),
      registrationDeadline: new Date('2026-10-01'),
      maxParticipants: 100,
      fee: 1500,
      status: 'upcoming',
      name: 'Кубок Nova Anglers Alliance 2026',
      region: 'Москва',
    },
  });
  console.log('✅ Соревнование создано:', competition.title);

  await db.organizerAssignment.upsert({
    where: { userId_competitionId: { userId: organizer.id, competitionId: competition.id } },
    update: {},
    create: {
      userId: organizer.id,
      competitionId: competition.id,
    },
  });
  console.log('✅ Организатор назначен на соревнование');

  const applications: any[] = [];
  for (let i = 0; i < athleteUsers.length; i++) {
    const { athlete } = athleteUsers[i];

    const app = await db.application.upsert({
      where: { id: `test-app-${i + 1}` },
      update: {},
      create: {
        id: `test-app-${i + 1}`,
        athleteId: athlete.id,
        competitionId: competition.id,
        status: i === 0 ? 'approved' : 'pending',
        fee: 1500,
        entryType: 'athlete',
        contactEmail: athleteUsers[i].user.email,
        applicationNumber: `NOVA-2026-${String(1000 + i).padStart(6, '0')}`,
        rawPayload: JSON.stringify({ firstname: athlete.firstName, lastname: athlete.lastName }),
      },
    });

    let paymentStatus: any = 'pending';
    let proofStatus: any = null;

    if (i === 0) {
      paymentStatus = 'paid';
      proofStatus = 'confirmed';
    } else if (i === 1) {
      proofStatus = 'awaiting_review';
    }

    await db.payment.upsert({
      where: { applicationId: app.id },
      update: {},
      create: {
        applicationId: app.id,
        amount: 1500,
        currency: 'RUB',
        status: paymentStatus,
        method: 'bank_transfer',
        proofStatus,
        proofFileUrl: i <= 1 ? '/uploads/test-receipt.jpg' : null,
        confirmedById: i === 0 ? organizer.id : null,
        confirmedAt: i === 0 ? new Date() : null,
      },
    });

    applications.push(app);
    console.log(`✅ Заявка ${i + 1} создана для ${athlete.firstName} ${athlete.lastName}`);
  }

  const resultData = [
    { athleteId: athleteUsers[0].athlete.id, place: 1, score: 95.5 },
    { athleteId: athleteUsers[1].athlete.id, place: 2, score: 88.2 },
    { athleteId: athleteUsers[2].athlete.id, place: 3, score: 82.0 },
  ];

  for (const result of resultData) {
    await db.competitionResult.upsert({
      where: { athleteId_competitionId: { athleteId: result.athleteId, competitionId: competition.id } },
      update: {},
      create: {
        athleteId: result.athleteId,
        competitionId: competition.id,
        place: result.place,
        score: result.score,
      },
    });
  }
  console.log('✅ Результаты соревнований созданы');

  const ratingData = [
    { athleteId: athleteUsers[0].athlete.id, place: 1, points: 100 },
    { athleteId: athleteUsers[1].athlete.id, place: 2, points: 80 },
    { athleteId: athleteUsers[2].athlete.id, place: 3, points: 60 },
  ];

  for (const rating of ratingData) {
    await db.ratingEntry.upsert({
      where: { athleteId_competitionId: { athleteId: rating.athleteId, competitionId: competition.id } },
      update: {},
      create: {
        athleteId: rating.athleteId,
        competitionId: competition.id,
        place: rating.place,
        points: rating.points,
        season: '2026',
      },
    });
  }
  console.log('✅ Записи рейтинга созданы');

  try {
    await db.paymentDetails.upsert({
      where: { id: 'default-payment-details' },
      update: {},
      create: {
        id: 'default-payment-details',
        competitionId: null,
        bankName: 'ПАО СБЕРБАНК',
        accountNumber: '40802810000000000000',
        bik: '044525225',
        inn: '7701234567',
        recipientName: 'Федерация рыболовного спорта Nova Anglers Alliance',
        paymentPurpose: 'Целевой взнос за участие в турнире',
      },
    });
    console.log('✅ Платёжные реквизиты созданы');
  } catch (error) {
    console.log('⚠️ Платёжные реквизиты уже существуют или ошибка:', error);
  }

  for (let i = 0; i < athleteUsers.length; i++) {
    const { athlete } = athleteUsers[i];
    const docKey = await createDemoDocument(`athlete-${athlete.id}-license.pdf`);

    await db.document.upsert({
      where: { id: `doc-${i + 1}` },
      update: {},
      create: {
        id: `doc-${i + 1}`,
        athleteId: athlete.id,
        type: 'license',
        fileName: 'Лицензия спортсмена.pdf',
        fileUrl: `/storage/documents/${docKey}`,
        fileKey: docKey,
        mimeType: 'application/pdf',
        sizeBytes: DEMO_PDF.length,
      },
    });
  }
  console.log('✅ Демо-документы созданы');

  console.log('\n🎉 Все тестовые данные успешно созданы!');
  console.log('\n📋 Данные для входа:');
  console.log('  Админ: admin@nova.ru / pass123');
  console.log('  Организатор: org@nova.ru / pass123');
  console.log('  Спортсмен 1: athlete1@nova.ru / pass123');
  console.log('  Спортсмен 2: athlete2@nova.ru / pass123');
  console.log('  Спортсмен 3: athlete3@nova.ru / pass123');
}

async function createDemoDocument(key: string): Promise<string> {
  const dir = path.join(process.cwd(), 'storage', 'documents');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, path.basename(key)), DEMO_PDF);
  return key;
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
