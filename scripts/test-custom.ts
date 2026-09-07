import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

// Resolve DATABASE_URL
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function main() {
  console.log('=== Custom Tests ===');

  // 1. Test storage
  console.log('\n1. Storage tests');
  const storage = await import('../src/lib/storage.ts');
  console.log('MAX_DOCUMENT_BYTES', storage.MAX_DOCUMENT_BYTES, 'expected', 10*1024*1024, storage.MAX_DOCUMENT_BYTES === 10*1024*1024 ? 'OK' : 'FAIL');
  console.log('MAX_PROOF_BYTES', storage.MAX_PROOF_BYTES, 'expected', 5*1024*1024, storage.MAX_PROOF_BYTES === 5*1024*1024 ? 'OK' : 'FAIL');

  const jpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46]);
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

  const detJpg = storage.detectDocumentType(jpg);
  const detPng = storage.detectDocumentType(png);
  const detPdf = storage.detectDocumentType(pdf);
  const detWebp = storage.detectDocumentType(webp);
  console.log('detect JPG', detJpg, detJpg?.ext === 'jpg' ? 'OK' : 'FAIL');
  console.log('detect PNG', detPng, detPng?.ext === 'png' ? 'OK' : 'FAIL');
  console.log('detect PDF', detPdf, detPdf?.ext === 'pdf' ? 'OK' : 'FAIL');
  console.log('detect WEBP', detWebp, detWebp?.ext === 'webp' ? 'OK' : 'FAIL');

  const key = await storage.saveFile(Buffer.from('test content'), 'txt');
  console.log('saveFile key', key, key.startsWith('documents/') ? 'OK' : 'FAIL');
  const read = await storage.readFileByKey(key);
  console.log('readFileByKey', read.toString() === 'test content' ? 'OK' : 'FAIL');
  await storage.deleteFileByKey(key);
  console.log('deleteFileByKey OK');

  const privateKey = await storage.savePrivateFile(Buffer.from('private'), 'proof_test.pdf');
  console.log('savePrivateFile key', privateKey, privateKey.includes('proof') ? 'OK' : 'FAIL');
  const stream = await storage.getPrivateFileStream(privateKey);
  console.log('getPrivateFileStream', stream && stream.stream.toString() === 'private' ? 'OK' : 'FAIL');
  await storage.deleteFileByKey(privateKey);

  const headers = storage.safeServeHeaders('test.pdf');
  console.log('safeServeHeaders', headers.contentType, headers.disposition ? 'OK' : 'FAIL');

  // 2. Test auth
  console.log('\n2. Auth tests');
  const auth = await import('../src/lib/auth.ts');
  console.log('getCurrentUser exists', typeof auth.getCurrentUser === 'function' ? 'OK' : 'FAIL');
  console.log('hashPassword', typeof auth.hashPassword === 'function' ? 'OK' : 'FAIL');
  const hash = auth.hashPassword('test123');
  console.log('verifyPassword', auth.verifyPassword('test123', hash) ? 'OK' : 'FAIL');

  // 3. Test lazy-expire 48h
  console.log('\n3. Lazy-expire 48h tests');
  const apps = await import('../src/lib/applications.ts');
  console.log('APPLICATION_EXPIRE_HOURS', apps.APPLICATION_EXPIRE_HOURS, apps.APPLICATION_EXPIRE_HOURS === 48 ? 'OK' : 'FAIL');
  console.log('lazyExpireApplications exists', typeof apps.lazyExpireApplications === 'function' ? 'OK' : 'FAIL');

  // Create an old pending application and test expire
  const oldApp = await prisma.application.create({
    data: {
      id: 'test-expire-app',
      competitionId: (await prisma.competition.findFirst()).id,
      status: 'pending',
      createdAt: new Date(Date.now() - 49 * 3600 * 1000),
      applicationNumber: 'TEST-EXPIRE-001',
      contactEmail: 'expire@test.ru',
    },
  });
  console.log('created old app', oldApp.id);
  const expiredCount = await apps.lazyExpireApplications();
  console.log('expiredCount', expiredCount, expiredCount >= 1 ? 'OK' : 'FAIL');
  const check = await prisma.application.findUnique({ where: { id: 'test-expire-app' } });
  console.log('check expired status', check?.status, check?.status === 'expired' ? 'OK' : 'FAIL');
  await prisma.application.delete({ where: { id: 'test-expire-app' } }).catch(()=>{});

  // 4. Test rating cache
  console.log('\n4. Rating cache tests');
  const rating = await import('../src/lib/rating.ts');
  console.log('clearRatingCache exists', typeof rating.clearRatingCache === 'function' ? 'OK' : 'FAIL');
  console.log('getCachedAggregatedRating exists', typeof rating.getCachedAggregatedRating === 'function' ? 'OK' : 'FAIL');
  console.log('computeGlobalRating exists', typeof rating.computeGlobalRating === 'function' ? 'OK' : 'FAIL');

  rating.clearRatingCache();
  const stats1 = rating.getRatingCacheStats();
  console.log('cache empty', !stats1.hasGlobal ? 'OK' : 'FAIL');

  const res1 = await rating.computeGlobalRating();
  console.log('computeGlobalRating result', res1.athletes ? 'OK' : 'FAIL');
  const stats2 = rating.getRatingCacheStats();
  console.log('cache filled', stats2.hasGlobal ? 'OK' : 'FAIL');

  const res2 = await rating.computeGlobalRating();
  console.log('cache hit (same updatedAt)', res1.updatedAt === res2.updatedAt ? 'OK' : 'FAIL');

  const cached = await rating.getCachedAggregatedRating('test-key', async () => ({ data: 'first', at: Date.now() }));
  console.log('getCachedAggregatedRating first', cached.data === 'first' ? 'OK' : 'FAIL');
  const cached2 = await rating.getCachedAggregatedRating('test-key', async () => ({ data: 'second', at: Date.now() }));
  console.log('getCachedAggregatedRating cached', cached2.data === 'first' ? 'OK' : 'FAIL');

  rating.clearRatingCache();

  console.log('\n=== All custom tests done ===');
}

main().catch(e=>{console.error(e); process.exit(1);}).finally(async()=>{await prisma.$disconnect(); await pool.end();});
