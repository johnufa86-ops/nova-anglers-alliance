/* ============================================================
   NOVA ANGLERS ALLIANCE — APPLICATIONS DATA-ACCESS LAYER
   ============================================================
   registration → competition → participant/team → application → status

   ЭТАП 4: внутри — реальный сервер (POST/GET/PATCH /api/...),
   централизованная база данных. localStorage остался только как
   кеш «заявок этого устройства» для удобства заявителя:
     • баннер «у вас уже есть заявка» до заполнения формы;
     • восстановление ссылки-подтверждения (?app=…&t=…).

   Источником истины является сервер: дубликаты, статусы и
   уникальные номера NOVA-YYYY-NNNNNN проверяются и выдаются им.

   Архитектура готова к будущей авторизации спортсмена: когда
   появится личный кабинет, методы ниже перейдут на пользовательский
   токен без изменения сигнатур.

   Интерфейс (совместим с этапом 3 + новые админ-методы):
     NOVAApplications.create(payload)
     NOVAApplications.getById(number [, token])
     NOVAApplications.listByCompetition(competitionId)
     NOVAApplications.listAll(filters)            — кабинет (роль от сервера)
     NOVAApplications.updateStatus(id, status, comment)
     NOVAApplications.getStatistics()
     NOVAApplications.exportCompetition(slug, format, scope)
   ============================================================ */

window.NOVAApplications = (function () {

  const DEVICE_KEY = 'nova_device_applications_v1';

  const STATUS_LABELS = {
    submitted: 'На рассмотрении',
    under_review: 'На проверке',
    approved: 'Подтверждена',
    needs_changes: 'Требует доработки',
    rejected: 'Отклонена',
    withdrawn: 'Отозвана',
  };

  // ----------------------------------------------------------
  // device-local cache (только собственные заявки этого браузера)
  // ----------------------------------------------------------
  function deviceRead() {
    try { return JSON.parse(localStorage.getItem(DEVICE_KEY) || '[]'); } catch (e) { return []; }
  }
  function deviceWrite(list) {
    try { localStorage.setItem(DEVICE_KEY, JSON.stringify(list)); } catch (e) { /* best-effort */ }
  }
  function deviceRemember(rec) {
    const list = deviceRead().filter((r) => r.number !== rec.number);
    list.push(rec);
    deviceWrite(list);
  }

  // ----------------------------------------------------------
  // submit — POST /api/applications
  // payload: { competitionId, entryType, participant }
  // резолвится объектом application или бросает нормализованную
  // ошибку { code, message, details } (см. js/api.js)
  // ----------------------------------------------------------
  async function create(payload) {
    const data = await NOVA_API.post('/api/applications', payload);
    const app = data && data.application;
    if (app) {
      deviceRemember({
        number: app.applicationNumber,
        token: app.accessToken,
        competitionId: payload.competitionId,
        participantName: app.participantName,
        status: app.status,
        submittedAt: app.submittedAt,
      });
    }
    return app;
  }

  // ----------------------------------------------------------
  // revisit — GET /api/applications/lookup?number=&token=
  // ----------------------------------------------------------
  async function getById(number, token) {
    let t = token;
    if (!t) {
      const local = deviceRead().find((r) => r.number === number);
      t = local && local.token;
    }
    if (!number || !t) throw { code: 'NOT_FOUND', message: 'Заявка не найдена. Проверьте ссылку или номер заявки.' };
    const data = await NOVA_API.get(
      `/api/applications/lookup?number=${encodeURIComponent(number)}&token=${encodeURIComponent(t)}`
    );
    const app = data && data.application;
    if (app) {
      deviceRemember({
        number: app.applicationNumber,
        token: t,
        competitionId: app.competition ? app.competition.slug : '',
        participantName: app.participantName,
        status: app.status,
        submittedAt: app.submittedAt,
      });
    }
    return app;
  }

  // ----------------------------------------------------------
  // «мои заявки на это соревнование» — из кеша устройства.
  // Реальный контроль дубликатов выполняет сервер при create().
  // ----------------------------------------------------------
  function listByCompetition(competitionId) {
    return deviceRead().filter((r) => r.competitionId === competitionId);
  }

  // ----------------------------------------------------------
  // ADMIN — кабинет организатора (роль проверяет сервер)
  // ----------------------------------------------------------
  async function listAll(filters) {
    const f = filters || {};
    const qs = new URLSearchParams();
    if (f.q) qs.set('q', f.q);
    if (f.competition) qs.set('competition', f.competition);
    if (f.status) qs.set('status', f.status);
    if (f.type) qs.set('type', f.type);
    if (f.dateFrom) qs.set('dateFrom', f.dateFrom);
    if (f.dateTo) qs.set('dateTo', f.dateTo);
    if (f.page) qs.set('page', f.page);
    if (f.pageSize) qs.set('pageSize', f.pageSize);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return NOVA_API.get(`/api/admin/applications${suffix}`);
  }

  async function getAdminById(id) {
    return NOVA_API.get(`/api/admin/applications/${encodeURIComponent(id)}`);
  }

  async function updateStatus(id, status, comment) {
    return NOVA_API.patch(`/api/admin/applications/${encodeURIComponent(id)}/status`, { status, comment });
  }

  async function getStatistics() {
    return NOVA_API.get('/api/admin/overview');
  }

  // ----------------------------------------------------------
  // STAGE 5 — документы спортсменов (проверка организатором)
  // ----------------------------------------------------------
  async function listDocuments(filters) {
    const f = filters || {};
    const qs = new URLSearchParams();
    if (f.status) qs.set('status', f.status);
    if (f.userId) qs.set('userId', f.userId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return NOVA_API.get(`/api/admin/documents${suffix}`);
  }

  async function reviewDocument(id, status, rejectReason) {
    return NOVA_API.patch(`/api/admin/documents/${encodeURIComponent(id)}`, { status, rejectReason });
  }

  /** URL скачивания выгрузки участников (organizer/admin; сервер проверит роль). */
  function exportCompetition(competitionSlug, format, scope) {
    const qs = new URLSearchParams({ format: format === 'xlsx' ? 'xlsx' : 'csv' });
    if (scope) qs.set('scope', scope);
    return `/api/admin/competitions/${encodeURIComponent(competitionSlug)}/export?${qs.toString()}`;
  }

  return {
    create,
    getById,
    listByCompetition,
    listAll,
    getAdminById,
    updateStatus,
    getStatistics,
    exportCompetition,
    listDocuments,
    reviewDocument,
    statusLabel: (s) => STATUS_LABELS[s] || s,
    STATUS_LABELS,
    /* cached device records (scoped to this browser only) */
    device: {
      list: deviceRead,
      findByCompetition: (competitionId) => deviceRead().filter((r) => r.competitionId === competitionId),
      clear: () => deviceWrite([]),
    },
  };
})();
