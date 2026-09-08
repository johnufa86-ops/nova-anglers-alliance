import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

const ADMIN_EMAIL = process.env.NOVA_ADMIN_EMAIL || 'johnufa86@gmail.com';
const ADMIN_PASS = process.env.NOVA_ADMIN_PASSWORD || 'Nova2026!Admin#Pro86';

async function main() {
  console.log('--- 1. Создание учётной записи администратора ---');
  const passwordHash = hashPassword(ADMIN_PASS);

  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      role: 'admin',
      name: 'Евгений (Администратор)',
      emailVerified: true,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      name: 'Евгений (Администратор)',
      emailVerified: true,
    },
  });

  console.log(`✅ Главный администратор настроен: ${admin.email} (ID: ${admin.id})`);

  console.log('--- 2. Очистка тестовых демо-данных ---');
  const demoEmails = ['admin@nova.ru', 'org@nova.ru', 'athlete1@nova.ru', 'athlete2@nova.ru', 'athlete3@nova.ru'];
  
  await db.applicationStatusHistory.deleteMany({});
  await db.applicationParticipant.deleteMany({});
  await db.applicationDocument.deleteMany({});
  await db.payment.deleteMany({});
  await db.application.deleteMany({});

  await db.competitionResult.deleteMany({});
  await db.ratingEntry.deleteMany({});
  await db.teamMember.deleteMany({});
  await db.team.deleteMany({});

  await db.athlete.deleteMany({});
  await db.session.deleteMany({});

  const deletedUsers = await db.user.deleteMany({
    where: { email: { in: demoEmails } },
  });
  console.log(`✅ Удалено демо-пользователей: ${deletedUsers.count}`);

  const remainingUsers = await db.user.findMany({ select: { id: true, email: true, role: true } });
  console.log('Пользователи в базе:', remainingUsers);

  console.log('--- Завершено успешно! ---');
}

main()
  .catch((e) => {
    console.error('Ошибка инициализации:', e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
