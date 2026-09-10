import { db } from '../src/lib/db';

async function cleanDB() {
  console.log('Deleting all test competitions from the database...');

  const testSlugs = [
    'nova-cup-volga',
    'bereg-rossii-1',
    'nova-don-summer',
    'kubok-kaspiya',
    'nova-fly-karelia',
  ];

  for (const slug of testSlugs) {
    const existing = await db.competition.findUnique({ where: { slug } });
    if (existing) {
      // Delete related applications first
      const deletedApps = await db.application.deleteMany({
        where: { competitionId: existing.id },
      });
      console.log(`  Deleted ${deletedApps.count} applications for ${slug}`);

      await db.competition.delete({ where: { slug } });
      console.log(`  ✓ Deleted competition: ${slug}`);
    } else {
      console.log(`  — ${slug} not found in DB (already deleted)`);
    }
  }

  const remaining = await db.competition.findMany({ select: { slug: true, title: true } });
  console.log(`\nRemaining competitions in DB: ${remaining.length}`);
  for (const c of remaining) {
    console.log(`  - ${c.slug}: ${c.title}`);
  }

  await db.$disconnect();
}

cleanDB().catch((err) => {
  console.error('Error:', err);
  db.$disconnect();
  process.exit(1);
});
