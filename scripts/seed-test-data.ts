import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Начинаю создание тестовых данных...');

  // Хешируем пароль "pass123"
  const passwordHash = await bcrypt.hash('pass123', 10);
  console.log('✅ Пароль захеширован');

  // 1. Создаём пользователей
  const admin = await prisma.user.upsert({
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

  const organizer = await prisma.user.upsert({
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

  const athleteUsers = [];
  const athleteData = [
    { email: 'athlete1@nova.ru', firstName: 'Иван', lastName: 'Петров', city: 'Москва', club: 'Спиннинг Про' },
    { email: 'athlete2@nova.ru', firstName: 'Пётр', lastName: 'Сидоров', city: 'Санкт-Петербург', club: 'Фидер Мастер' },
    { email: 'athlete3@nova.ru', firstName: 'Алексей', lastName: 'Иванов', city: 'Казань', club: 'Карп Клуб' },
  ];

  for (const data of athleteData) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        passwordHash,
        role: 'ATHLETE',
        emailVerified: true,
      },
    });

    const athlete = await prisma.athlete.upsert({
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

  // 2. Создаём соревнование
  const competition = await prisma.competition.upsert({
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
    },
  });
  console.log('✅ Соревнование создано:', competition.title);

  // 3. Назначаем организатора на соревнование
  await prisma.organizerAssignment.upsert({
    where: { userId_competitionId: { userId: organizer.id, competitionId: competition.id } },
    update: {},
    create: {
      userId: organizer.id,
      competitionId: competition.id,
    },
  });
  console.log('✅ Организатор назначен на соревнование');

  // 4. Создаём заявки и платежи
  const applications = [];
  for (let i = 0; i < athleteUsers.length; i++) {
    const { athlete } = athleteUsers[i];
    
    const app = await prisma.application.upsert({
      where: { id: `test-app-${i + 1}` },
      update: {},
      create: {
        id: `test-app-${i + 1}`,
        athleteId: athlete.id,
        competitionId: competition.id,
        status: i === 0 ? 'approved' : 'pending',
        fee: 1500,
      },
    });

    let paymentStatus: 'pending' | 'paid' = 'pending';
    let proofStatus: string | null = null;

    if (i === 0) {
      paymentStatus = 'paid';
      proofStatus = 'confirmed';
    } else if (i === 1) {
      proofStatus = 'awaiting_review';
    }

    await prisma.payment.upsert({
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

  // 5. Создаём результаты соревнований (для рейтинга)
  const resultData = [
    { athleteId: athleteUsers[0].athlete.id, place: 1, score: 95.5 },
    { athleteId: athleteUsers[1].athlete.id, place: 2, score: 88.2 },
    { athleteId: athleteUsers[2].athlete.id, place: 3, score: 82.0 },
  ];

  for (const result of resultData) {
    await prisma.competitionResult.upsert({
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

  // 6. Создаём записи рейтинга
  const ratingData = [
    { athleteId: athleteUsers[0].athlete.id, place: 1, points: 100 },
    { athleteId: athleteUsers[1].athlete.id, place: 2, points: 80 },
    { athleteId: athleteUsers[2].athlete.id, place: 3, points: 60 },
  ];

  for (const rating of ratingData) {
    await prisma.ratingEntry.upsert({
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

  // 7. Создаём платёжные реквизиты
  await prisma.paymentDetails.upsert({
    where: { competitionId: null },
    update: {},
    create: {
      competitionId: null,
      bankName: 'ПАО СБЕРБАНК',
      accountNumber: '40802810000000000000',
      bik: '044525225',
      inn: '7701234567',
      recipientName: 'Федерация рыболовного спорта Nova Anglers Alliance',
      paymentPurpose: 'Целевой взнос за участие в турнире',
    },
  }).catch(() => {
    console.log('⚠️ Платёжные реквизиты уже существуют или ошибка с null');
  });
  console.log('✅ Платёжные реквизиты созданы');

  console.log('\n🎉 Все тестовые данные успешно созданы!');
  console.log('\n📋 Данные для входа:');
  console.log('  Админ: admin@nova.ru / pass123');
  console.log('  Организатор: org@nova.ru / pass123');
  console.log('  Спортсмен 1: athlete1@nova.ru / pass123');
  console.log('  Спортсмен 2: athlete2@nova.ru / pass123');
  console.log('  Спортсмен 3: athlete3@nova.ru / pass123');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });