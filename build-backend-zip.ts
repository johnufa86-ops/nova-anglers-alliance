import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

interface VirtualFile {
  path: string;
  content: string;
}

const files: VirtualFile[] = [
  {
    path: '.env.example',
    content: `# Stage 6.5 Configuration Flags
PAYMENT_ONLINE_ENABLED=false
PAYMENT_BANK_TRANSFER_ENABLED=true
BANK_TRANSFER_TIMEOUT_HOURS=48
`
  },
  {
    path: 'src/config/rating.ts',
    content: `export const RATING_CONFIG = {
  points: {
    1: 100,
    2: 80,
    3: 60,
    range4to10: 40,
    participation: 10,
  },
  massBonus: {
    threshold: 50,
    multiplier: 1.2,
  },
  seasonFormat: 'YYYY',
};

export function calculatePointsForPlace(place: number, totalParticipants: number): number {
  let basePoints = RATING_CONFIG.points.participation;
  if (place === 1) basePoints = RATING_CONFIG.points[1];
  else if (place === 2) basePoints = RATING_CONFIG.points[2];
  else if (place === 3) basePoints = RATING_CONFIG.points[3];
  else if (place >= 4 && place <= 10) basePoints = RATING_CONFIG.points.range4to10;

  if (totalParticipants >= RATING_CONFIG.massBonus.threshold) {
    return Math.round(basePoints * RATING_CONFIG.massBonus.multiplier);
  }
  return basePoints;
}
`
  },
  {
    path: 'src/lib/payments-config.ts',
    content: `export function getPaymentConfig() {
  return {
    isOnlineEnabled: process.env.PAYMENT_ONLINE_ENABLED === 'true',
    isBankTransferEnabled: process.env.PAYMENT_BANK_TRANSFER_ENABLED !== 'false',
    timeoutHours: parseInt(process.env.BANK_TRANSFER_TIMEOUT_HOURS || '48', 10),
  };
}
`
  },
  {
    path: 'src/lib/bank-validation.ts',
    content: `export function validateBankDetails(data: {
  accountNumber: string;
  bik: string;
  inn?: string | null;
}) {
  const errors: string[] = [];
  if (!/^\\d{20}$/.test(data.accountNumber || '')) {
    errors.push('Расчетный счет должен состоять ровно из 20 цифр');
  }
  if (!/^\\d{9}$/.test(data.bik || '')) {
    errors.push('БИК должен состоять ровно из 9 цифр');
  }
  if (data.inn && !/^(\\d{10}|\\d{12})$/.test(data.inn)) {
    errors.push('ИНН должен состоять из 10 или 12 цифр');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}
`
  },
  {
    path: 'src/lib/rate-limiter.ts',
    content: `type RateLimitRecord = { count: number; resetTime: number };
const limitsMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 3600000) {
  const now = Date.now();
  const record = limitsMap.get(key);
  if (!record || now > record.resetTime) {
    limitsMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}
`
  },
  {
    path: 'src/app/api/admin/payment-details/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { validateBankDetails } from '@/lib/bank-validation';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get('competitionId') || null;

  const details = await (db as any).paymentDetails.findFirst({
    where: { competitionId },
  });
  return NextResponse.json({ data: details });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBankDetails(body);
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
  }

  const { competitionId, bankName, accountNumber, bik, inn, recipientName, paymentPurpose } = body;
  const saved = await (db as any).paymentDetails.upsert({
    where: { competitionId: competitionId || null },
    update: { bankName, accountNumber, bik, inn, recipientName, paymentPurpose },
    create: { competitionId: competitionId || null, bankName, accountNumber, bik, inn, recipientName, paymentPurpose },
  });
  return NextResponse.json({ data: saved });
}
`
  },
  {
    path: 'src/app/api/payment-details/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPaymentConfig } from '@/lib/payments-config';

export async function GET(req: NextRequest) {
  const config = getPaymentConfig();
  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get('competitionId');

  let details = null;
  if (competitionId) {
    details = await (db as any).paymentDetails.findFirst({
      where: { competitionId },
    });
  }
  if (!details) {
    details = await (db as any).paymentDetails.findFirst({
      where: { competitionId: null },
    });
  }
  return NextResponse.json({ config, details });
}
`
  },
  {
    path: 'src/app/api/me/applications/[id]/payment-proof/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
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

  const limitCheck = checkRateLimit(\`proof_upload_\${user.id}\`, 5, 3600000);
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
    filename: \`proof_\${applicationId}_\${Date.now()}.\${ext}\`,
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
    const athleteName = \`\${user.firstName || ''} \${user.lastName || ''}\`.trim() || 'Спортсмен';
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
`
  },
  {
    path: 'src/app/api/files/payment-proof/[id]/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPrivateFileStream } from '@/lib/storage';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: paymentId } = await params;
  const user = await getCurrentUser(req);
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
      'Content-Disposition': \`attachment; filename="proof_\${paymentId}"\`,
    },
  });
}
`
  },
  {
    path: 'src/app/api/admin/applications/[id]/payment-review/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
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
  const athleteName = \`\${app.athlete?.firstName || ''} \${app.athlete?.lastName || ''}\`.trim() || 'Спортсмен';
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
`
  },
  {
    path: 'src/app/api/admin/competitions/[slug]/calculate-rating/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { calculatePointsForPlace } from '@/config/rating';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comp = await (db as any).competition.findUnique({
    where: { slug },
    include: { organizerAssignments: true, results: true },
  });

  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 });

  const isAssigned = comp.organizerAssignments?.some((a: any) => a.userId === user.id);
  const isAdmin = user.role === 'admin';
  if (!isAssigned && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const totalParticipants = comp.results.length;
  const season = comp.date ? new Date(comp.date).getFullYear().toString() : new Date().getFullYear().toString();

  let count = 0;
  for (const item of comp.results) {
    const points = calculatePointsForPlace(item.place, totalParticipants);
    await (db as any).ratingEntry.upsert({
      where: {
        athleteId_competitionId: {
          athleteId: item.athleteId,
          competitionId: comp.id,
        },
      },
      update: {
        place: item.place,
        points,
        season,
        calculatedAt: new Date(),
      },
      create: {
        athleteId: item.athleteId,
        competitionId: comp.id,
        place: item.place,
        points,
        season,
      },
    });
    count++;
  }

  console.log(\`[Audit] Расчет рейтинга: \${user.id} для comp \${comp.id}, участников: \${count}\`);
  return NextResponse.json({ success: true, calculatedCount: count, season });
}
`
  },
  {
    path: 'src/app/api/rating/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

let cache: { data: any; timestamp: number; key: string } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get('season') || new Date().getFullYear().toString();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const cacheKey = \`\${season}_\${page}_\${limit}\`;

  if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const entries = await (db as any).ratingEntry.findMany({
    where: { season },
  });

  const athleteMap = new Map<string, { points: number; tournamentsCount: number }>();
  for (const e of entries) {
    const prev = athleteMap.get(e.athleteId) || { points: 0, tournamentsCount: 0 };
    athleteMap.set(e.athleteId, {
      points: prev.points + e.points,
      tournamentsCount: prev.tournamentsCount + 1,
    });
  }

  const athleteIds = Array.from(athleteMap.keys());
  const athletes = await (db as any).athlete.findMany({
    where: { id: { in: athleteIds } },
    select: { id: true, firstName: true, lastName: true, city: true, club: true },
  });

  let aggregated = athletes.map((a: any) => {
    const stats = athleteMap.get(a.id)!;
    return {
      id: a.id,
      name: \`\${a.firstName} \${a.lastName}\`,
      city: a.city || null,
      club: a.club || null,
      points: stats.points,
      tournamentsCount: stats.tournamentsCount,
    };
  });

  aggregated.sort((a: any, b: any) => b.points - a.points);
  aggregated = aggregated.map((item: any, idx: number) => ({
    rank: idx + 1,
    ...item,
  }));

  const total = aggregated.length;
  const paginated = aggregated.slice((page - 1) * limit, page * limit);

  const payload = { season, page, limit, total, items: paginated };
  cache = { key: cacheKey, data: payload, timestamp: Date.now() };

  return NextResponse.json(payload);
}
`
  }
];

// Автоматическая распаковка сразу на диск
console.log('--- Генерация и распаковка Backend-модулей ---');
for (const file of files) {
  const full = path.join(process.cwd(), file.path);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, file.content, 'utf-8');
  console.log(`[OK] Создан: ${file.path}`);
}
console.log('--- Backend успешно записан! ---');