import * as fs from 'fs';
import * as path from 'path';

function writeFile(relPath: string, content: string) {
  const fullPath = path.join(process.cwd(), relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trimStart(), 'utf-8');
  console.log(`[OK] Записан: ${relPath}`);
}

console.log('--- Обновление критических компонентов Этапа 6.5 ---');

// ============================================================================
// 1. ПОЛНЫЙ prisma/schema.prisma
// ============================================================================
writeFile(
  'prisma/schema.prisma',
  `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ATHLETE
  ORGANIZER
  ADMIN
}

enum ApplicationStatus {
  draft
  pending
  approved
  rejected
  cancelled
  expired
}

enum PaymentStatus {
  pending
  paid
  failed
  refunded
  expired
}

enum DocumentStatus {
  pending
  approved
  rejected
}

model User {
  id               String   @id @default(uuid())
  email            String   @unique
  passwordHash     String
  role             Role     @default(USER)
  emailVerified    Boolean  @default(false)
  verificationToken String?
  resetToken       String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  athlete          Athlete?
  organizerAssignments OrganizerAssignment[]
}

model Athlete {
  id              String   @id @default(uuid())
  userId          String?  @unique
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  firstName       String
  lastName        String
  middleName      String?
  birthDate       DateTime?
  gender          String?
  city            String?
  club            String?
  sportsCategory  String?
  phone           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  applications    Application[]
  documents       Document[]
  results         CompetitionResult[]
  ratingEntries   RatingEntry[]
}

model Competition {
  id                  String   @id @default(uuid())
  slug                String   @unique
  title               String
  description         String?
  discipline          String?
  category            String?
  location            String?
  date                DateTime?
  registrationDeadline DateTime?
  maxParticipants     Int?
  fee                 Float?   @default(0)
  status              String   @default("upcoming")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  applications        Application[]
  results             CompetitionResult[]
  ratingEntries       RatingEntry[]
  organizerAssignments OrganizerAssignment[]
  paymentDetails      PaymentDetails?
}

model OrganizerAssignment {
  id             String      @id @default(uuid())
  userId         String
  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  competitionId  String
  competition    Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  assignedAt     DateTime    @default(now())

  @@unique([userId, competitionId])
}

model Application {
  id             String            @id @default(uuid())
  athleteId      String
  athlete        Athlete           @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  competitionId  String
  competition    Competition       @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  status         ApplicationStatus @default(pending)
  fee            Float?            @default(0)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  payment        Payment?
}

model Payment {
  id              String        @id @default(uuid())
  applicationId   String        @unique
  application     Application   @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  amount          Float
  currency        String        @default("RUB")
  status          PaymentStatus @default(pending)
  
  transactionId   String?       @unique
  provider        String?
  
  method          String        @default("online")
  proofFileUrl    String?
  proofStatus     String?
  rejectReason    String?
  confirmedById   String?
  confirmedAt     DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model PaymentDetails {
  id              String       @id @default(uuid())
  competitionId   String?      @unique
  competition     Competition? @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  bankName        String
  accountNumber   String
  bik             String
  inn             String?
  recipientName   String
  paymentPurpose  String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model RatingEntry {
  id            String      @id @default(uuid())
  athleteId     String
  athlete       Athlete     @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  competitionId String
  competition   Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  place         Int
  points        Int
  season        String
  calculatedAt  DateTime    @default(now())

  @@unique([athleteId, competitionId])
}

model CompetitionResult {
  id            String      @id @default(uuid())
  athleteId     String
  athlete       Athlete     @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  competitionId String
  competition   Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  place         Int
  score         Float?
  createdAt     DateTime    @default(now())

  @@unique([athleteId, competitionId])
}

model Document {
  id             String         @id @default(uuid())
  athleteId      String
  athlete        Athlete        @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  type           String
  fileUrl        String
  status         DocumentStatus @default(pending)
  rejectionReason String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}
`
);

// ============================================================================
// 2. ПОЛНЫЙ src/lib/email/templates.ts
// ============================================================================
writeFile(
  'src/lib/email/templates.ts',
  `export interface EmailTemplateResult {
  subject: string;
  html: string;
}

export function verificationEmail(params: { name: string; verifyUrl: string }): EmailTemplateResult {
  return {
    subject: 'Подтверждение регистрации на платформе Nova Anglers Alliance',
    html: \`
      <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
        <h2>Здравствуйте, \${params.name}!</h2>
        <p>Благодарим за регистрацию. Пожалуйста, подтвердите ваш e-mail, перейдя по ссылке:</p>
        <p><a href="\${params.verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Подтвердить e-mail</a></p>
        <p>Если вы не регистрировались на сайте, просто проигнорируйте это письмо.</p>
      </div>
    \`,
  };
}

export function paymentProofReceivedEmail(params: { athleteName: string; competitionTitle: string }): EmailTemplateResult {
  return {
    subject: \`Подтверждение оплаты получено: \${params.competitionTitle}\`,
    html: \`
      <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
        <h2>Здравствуйте, \${params.athleteName}!</h2>
        <p>Подтверждение оплаты (чек) за участие в турнире <strong>«\${params.competitionTitle}»</strong> успешно загружено и ожидает проверки организатором.</p>
        <p>Обычно модерация занимает до 24 часов. Вы получите отдельное письмо с решением.</p>
      </div>
    \`,
  };
}

export function paymentProofConfirmedEmail(params: { athleteName: string; competitionTitle: string }): EmailTemplateResult {
  return {
    subject: \`Оплата подтверждена: \${params.competitionTitle}\`,
    html: \`
      <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
        <h2>Поздравляем, \${params.athleteName}!</h2>
        <p>Ваша оплата за участие в турнире <strong>«\${params.competitionTitle}»</strong> успешно подтверждена.</p>
        <p>Вы допущены к соревнованиям. Желаем успешного выступления!</p>
      </div>
    \`,
  };
}

export function paymentProofRejectedEmail(params: { athleteName: string; competitionTitle: string; reason: string }): EmailTemplateResult {
  return {
    subject: \`Требуется уточнение оплаты: \${params.competitionTitle}\`,
    html: \`
      <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
        <h2>Здравствуйте, \${params.athleteName}.</h2>
        <p>К сожалению, организатор отклонил загруженный чек для турнира <strong>«\${params.competitionTitle}»</strong>.</p>
        <p style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 10px; margin: 15px 0;"><strong>Причина:</strong> \${params.reason}</p>
        <p>Пожалуйста, перейдите в личный кабинет спортсмена и прикрепите корректный документ подтверждения.</p>
      </div>
    \`,
  };
}
`
);

// ============================================================================
// 3. ПОЛНЫЙ src/app/api/payments/create/route.ts (с Guard на 503)
// ============================================================================
writeFile(
  'src/app/api/payments/create/route.ts',
  `import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPaymentConfig } from '@/lib/payments-config';

export async function POST(req: NextRequest) {
  // Guard Этапа 6.5: Скрытие онлайн-эквайринга
  if (!getPaymentConfig().isOnlineEnabled) {
    return NextResponse.json({ error: 'Online payment disabled' }, { status: 503 });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { applicationId } = body;

  if (!applicationId) {
    return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
  }

  const app = await (db as any).application.findUnique({
    where: { id: applicationId },
    include: { payment: true, athlete: true },
  });

  if (!app || app.athlete.userId !== user.id) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (app.payment?.status === 'paid') {
    return NextResponse.json({ error: 'Already paid' }, { status: 400 });
  }

  const amount = app.fee || 1000;
  const payment = await (db as any).payment.upsert({
    where: { applicationId },
    update: {
      amount,
      method: 'online',
      status: 'pending',
    },
    create: {
      applicationId,
      amount,
      currency: 'RUB',
      method: 'online',
      status: 'pending',
    },
  });

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    amount,
    currency: 'RUB',
  });
}
`
);

console.log('--- Все 3 ключевых компонента успешно развернуты! ---');