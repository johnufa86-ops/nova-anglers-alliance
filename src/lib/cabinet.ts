import { db } from '@/lib/db';

/**
 * STAGE 5 — доменная логика личного кабинета спортсмена.
 * Общие функции для /api/me/*: профиль, результаты/рейтинг, документы.
 */

// ------------------------------------------------------------
// результаты и рейтинг
// ------------------------------------------------------------

export type ResultRow = {
  athleteName?: string;
  teamName?: string;
  score?: string;
  novaPoints?: string | number;
  place?: number;
};

/** Очки из строки протокола: число или «—» → 0. */
export function parseNovaPoints(v: ResultRow['novaPoints']): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
    return isFinite(n) ? n : 0;
  }
  return 0;
}

/** Нормализация названия команды/экипажа для сопоставления строк протокола. */
export function normalizeName(v: string): string {
  return v
    .toLowerCase()
    .replace(/экипаж/g, '')
    .replace(/[«»"']/g, '')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Сравнение имён без учёта порядка слов («Волков Артём» === «Артём Волков»):
 * протоколы пишут ФИО в свободном порядке.
 */
export function samePersonName(a: string, b: string): boolean {
  const ta = normalizeName(a).split(' ').filter(Boolean).sort();
  const tb = normalizeName(b).split(' ').filter(Boolean).sort();
  return ta.length > 0 && ta.length === tb.length && ta.every((w, i) => w === tb[i]);
}

/**
 * Результаты и очки рейтинга NOVA спортсмена.
 *
 * Источник — протоколы content.results завершённых/идущих соревнований,
 * где заявка спортсмена подтверждена (approved). Строка протокола
 * сопоставляется по displayName (личный зачёт) или названию экипажа
 * (командный). Сопоставление мягкое: регистр/кавычки/«Экипаж» не важны.
 */
export async function computeAthleteResults(userId: string): Promise<{
  items: {
    applicationNumber: string;
    competition: { slug: string; name: string; shortName: string; dateLabel: string; pointsMultiplier: string };
    entryType: string;
    displayName: string;
    score: string;
    novaPoints: number;
    place: number | null;
  }[];
  totalPoints: number;
  competitions: number;
}> {
  const apps = await db.application.findMany({
    where: { userId, status: 'approved' },
    include: {
      team: { select: { name: true } },
      participants: {
        include: { athlete: { select: { displayName: true, userId: true } } },
        orderBy: { createdAt: 'asc' },
      },
      competition: {
        select: {
          slug: true, name: true, shortName: true, dateLabel: true,
          pointsMultiplier: true, status: true, content: true,
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });

  const items: {
    applicationNumber: string;
    competition: { slug: string; name: string; shortName: string; dateLabel: string; pointsMultiplier: string };
    entryType: string;
    displayName: string;
    score: string;
    novaPoints: number;
    place: number | null;
  }[] = [];

  for (const app of apps) {
    const comp = app.competition;
    if (!['completed', 'in_progress'].includes(comp.status)) continue;

    let results: ResultRow[] = [];
    try {
      const parsed = JSON.parse(comp.content || '{}');
      results = Array.isArray(parsed.results) ? parsed.results : [];
    } catch {
      continue;
    }

    // кого ищем в протоколе: для личного зачёта — своего спортсмена,
    // для экипажа — название команды
    const ownAthlete = app.participants.find((p) => p.athlete.userId === userId);
    const soloName = ownAthlete?.athlete.displayName || null;
    const teamName = app.team?.name || null;

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      let matched = false;
      if (soloName && row.athleteName && samePersonName(row.athleteName, soloName)) {
        matched = true;
      }
      if (!matched && teamName && row.teamName && normalizeName(row.teamName).includes(normalizeName(teamName))) {
        matched = true;
      }
      if (!matched) continue;

      items.push({
        applicationNumber: app.applicationNumber || '',
        competition: {
          slug: comp.slug,
          name: comp.name || '',
          shortName: (comp.shortName || comp.name || '') as string,
          dateLabel: comp.dateLabel || '',
          pointsMultiplier: comp.pointsMultiplier || '×1.0',
        },
        entryType: app.entryType || 'athlete',
        displayName: soloName || (teamName ? `Экипаж «${teamName}»` : '—'),
        score: String(row.score ?? '—'),
        novaPoints: parseNovaPoints(row.novaPoints),
        place: i + 1,
      });
    }
  }

  const totalPoints = items.reduce((sum, r) => sum + r.novaPoints, 0);
  const competitions = new Set(items.map((r) => r.competition.slug)).size;
  return { items, totalPoints, competitions };
}

// ------------------------------------------------------------
// документы — «истечение» медсправок
// ------------------------------------------------------------

/**
 * Ленивое истечение: справка с прошедшей датой expiresAt помечается
 * expired при чтении списков (статус меняется только для pending/approved —
 * принятые и отклонённые решения не перезаписываем). Без аргумента —
 * глобально (вызывается из кабинета организатора).
 */
export async function lazyExpireDocuments(userId?: string): Promise<void> {
  await db.document.updateMany({
    where: {
      ...(userId ? { userId } : {}),
      status: { in: ['pending', 'approved'] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  });
}

export const DOCUMENT_TYPES = ['medical', 'federation_id', 'passport'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  medical: 'Медицинская справка',
  federation_id: 'Удостоверение федерации',
  passport: 'Паспорт (разворот)',
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'На проверке',
  approved: 'Принят',
  rejected: 'Отклонён',
  expired: 'Истёк срок',
};

/** Сериализация документа для фронтенда. Ключ хранения (fileUrl) наружу не отдаём. */
export function serializeDocument(d: {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  rejectReason: string | null;
  uploadedAt: Date;
  expiresAt: Date | null;
  reviewedAt: Date | null;
}) {
  return {
    id: d.id,
    type: d.type,
    typeLabel: DOCUMENT_TYPE_LABELS[d.type] || d.type,
    fileName: d.fileName,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    status: d.status,
    statusLabel: DOCUMENT_STATUS_LABELS[d.status] || d.status,
    rejectReason: d.rejectReason,
    uploadedAt: d.uploadedAt,
    expiresAt: d.expiresAt,
    downloadUrl: `/api/files/${d.id}`,
  };
}
