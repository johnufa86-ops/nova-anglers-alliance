import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { handle, ERR } from '@/lib/api';
import { requireUser, scopedCompetitionIds } from '@/lib/auth';
import { STATUS_LABELS, ENTRY_TYPE_LABELS } from '@/lib/applications';

/**
 * GET /api/admin/competitions/:slug/export?format=csv|xlsx&scope=approved|all
 *
 * Exports the participant list of one competition.
 * Default scope: approved only (spec §16). Roles: admin / organizer.
 * The response is a file download — CSV (Excel-friendly, BOM + «;») or XLSX.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const user = await requireUser(['admin', 'organizer']);
    const { slug } = await params;

    const c = await db.competition.findUnique({ where: { slug } });
    if (!c) throw ERR.NOT_FOUND('Соревнование не найдено');

    if (user.role === 'organizer') {
      const scope = await scopedCompetitionIds(user);
      if (scope && !scope.includes(c.id)) throw ERR.FORBIDDEN('Это соревнование не закреплено за вами');
    }

    const url = new URL(req.url);
    const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    const scopeParam = url.searchParams.get('scope');
    const scope = scopeParam === 'all' ? 'all' : 'approved';

    const apps = await db.application.findMany({
      where: { competitionId: c.id, ...(scope === 'approved' ? { status: 'approved' } : {}) },
      include: {
        team: { select: { name: true } },
        participants: {
          include: {
            athlete: {
              select: {
                displayName: true, phone: true, email: true,
                region: true, city: true, club: true, sportsCategory: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const rows = apps.map((a: any, i: number) => {
      const isTeam = a.entryType === 'team';
      const athletes = a.participants.map((p: any) => p.athlete);
      return {
        num: i + 1,
        applicationNumber: a.applicationNumber,
        participantName: isTeam ? a.team?.name || 'Экипаж' : athletes[0]?.displayName || '',
        roster: isTeam ? athletes.map((x: any) => x.displayName).join(', ') : '',
        club: athletes[0]?.club || a.team?.club || '',
        region: athletes[0]?.region || '',
        city: athletes[0]?.city || '',
        phone: a.contactPhone || athletes[0]?.phone || '',
        email: a.contactEmail || athletes[0]?.email || '',
        entryType: ENTRY_TYPE_LABELS[a.entryType] || a.entryType,
        status: STATUS_LABELS[a.status] || a.status,
        submittedAt: new Date(a.submittedAt).toLocaleString('ru-RU'),
      };
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const base = `nova-participants-${c.slug}-${stamp}`;

    if (format === 'csv') {
      const headers = [
        '№', 'Номер заявки', 'Участник / экипаж', 'Состав экипажа', 'Клуб',
        'Регион', 'Город', 'Телефон', 'E-mail', 'Тип', 'Статус', 'Дата подачи',
      ];
      const esc = (v: any) => {
        const s = String(v ?? '');
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(';')];
      for (const r of rows) {
        lines.push(
          [r.num, r.applicationNumber, r.participantName, r.roster, r.club, r.region,
           r.city, r.phone, r.email, r.entryType, r.status, r.submittedAt].map(esc).join(';')
        );
      }
      // UTF-8 BOM so Excel opens Cyrillic correctly
      const body = '\uFEFF' + lines.join('\r\n');
      return new Response(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${base}.csv"`,
        },
      });
    }

    // ---- XLSX -------------------------------------------------------------
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NOVA Anglers Alliance';
    const ws = wb.addWorksheet('Участники');
    ws.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Номер заявки', key: 'applicationNumber', width: 18 },
      { header: 'Участник / экипаж', key: 'participantName', width: 28 },
      { header: 'Состав экипажа', key: 'roster', width: 34 },
      { header: 'Клуб', key: 'club', width: 22 },
      { header: 'Регион', key: 'region', width: 22 },
      { header: 'Город', key: 'city', width: 16 },
      { header: 'Телефон', key: 'phone', width: 18 },
      { header: 'E-mail', key: 'email', width: 26 },
      { header: 'Тип', key: 'entryType', width: 12 },
      { header: 'Статус', key: 'status', width: 16 },
      { header: 'Дата подачи', key: 'submittedAt', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(r as any);
    const buf = await wb.xlsx.writeBuffer();

    return new Response(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${base}.xlsx"`,
      },
    });
  });
}
