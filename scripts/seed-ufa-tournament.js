const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oaarqdjbdeczzgzpbagi:iNA-KhT-MZx-6R9@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const comp = {
    slug: 'nova-street-river-ufa-2026',
    title: 'NOVA Street & River — Уфа 2026',
    shortName: 'NOVA Street & River',
    name: 'NOVA Street & River — Уфа 2026',
    description: 'Первый масштабный осенний фестиваль берегового спиннинга в Уфе. Уникальный динамичный формат — 3 тура по 1 часу на выбывание (плей-офф), честная спортивная борьба в наколотой зоне, строгий принцип «Поймал — Отпусти» и прямой денежный призовой фонд за 1, 2 и 3 места!',
    discipline: 'spinning',
    disciplineLabel: 'Береговой спиннинг',
    category: 'open',
    location: 'г. Уфа, секретная акватория (раскрытие за 7 дней)',
    region: 'Республика Башкортостан',
    dateLabel: '10 октября 2026',
    startDate: new Date('2026-10-10T04:00:00Z'),
    endDate: new Date('2026-10-10T16:00:00Z'),
    date: new Date('2026-10-10T04:00:00Z'),
    maxEntries: 60,
    maxParticipants: 60,
    fee: 2000,
    entryFee: 2000,
    prizeFund: '50% от взносов + кубки и подарки спонсоров',
    status: 'upcoming',
    format: 'Личный зачёт, 3 тура по 1 часу (плей-офф)',
    entryType: 'individual',
    organizer: 'NOVA Anglers Alliance',
    contact: 'info@nova-anglers.ru',
    days: 1,
    pointsMultiplier: '×1.0',
    content: '{}'
  };

  try {
    console.log('Inserting/updating tournament in Supabase...');
    const checkRes = await pool.query('SELECT id FROM "Competition" WHERE slug = $1', [comp.slug]);
    
    if (checkRes.rows.length > 0) {
      const id = checkRes.rows[0].id;
      console.log('Tournament already exists with ID:', id, 'Updating...');
      await pool.query(`
        UPDATE "Competition" SET
          title = $1, "shortName" = $2, name = $3, description = $4,
          discipline = $5, "disciplineLabel" = $6, category = $7,
          location = $8, region = $9, "dateLabel" = $10,
          "startDate" = $11, "endDate" = $12, date = $13,
          "maxEntries" = $14, "maxParticipants" = $15, fee = $16, "entryFee" = $17,
          "prizeFund" = $18, status = $19, format = $20, "entryType" = $21,
          organizer = $22, contact = $23, days = $24, "pointsMultiplier" = $25,
          "updatedAt" = NOW()
        WHERE id = $26
      `, [
        comp.title, comp.shortName, comp.name, comp.description,
        comp.discipline, comp.disciplineLabel, comp.category,
        comp.location, comp.region, comp.dateLabel,
        comp.startDate, comp.endDate, comp.date,
        comp.maxEntries, comp.maxParticipants, comp.fee, comp.entryFee,
        comp.prizeFund, comp.status, comp.format, comp.entryType,
        comp.organizer, comp.contact, comp.days, comp.pointsMultiplier,
        id
      ]);
      console.log('Updated tournament successfully!');
    } else {
      const { v4: uuidv4 } = require('uuid');
      const newId = uuidv4();
      console.log('Inserting new tournament with ID:', newId);
      await pool.query(`
        INSERT INTO "Competition" (
          id, slug, title, "shortName", name, description,
          discipline, "disciplineLabel", category, location, region, "dateLabel",
          "startDate", "endDate", date, "maxEntries", "maxParticipants", fee, "entryFee",
          "prizeFund", status, format, "entryType", organizer, contact, days, "pointsMultiplier",
          content, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27,
          $28, NOW(), NOW()
        )
      `, [
        newId, comp.slug, comp.title, comp.shortName, comp.name, comp.description,
        comp.discipline, comp.disciplineLabel, comp.category, comp.location, comp.region, comp.dateLabel,
        comp.startDate, comp.endDate, comp.date, comp.maxEntries, comp.maxParticipants, comp.fee, comp.entryFee,
        comp.prizeFund, comp.status, comp.format, comp.entryType, comp.organizer, comp.contact, comp.days, comp.pointsMultiplier,
        comp.content
      ]);
      console.log('Tournament inserted successfully!');
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end();
  }
}

main();
