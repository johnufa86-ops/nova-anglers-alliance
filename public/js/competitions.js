/* ============================================================
   NOVA ANGLERS ALLIANCE — COMPETITIONS DATA-ACCESS LAYER
   ============================================================
   Данные соревнований теперь приходят с сервера (реальная база).
   Демо-набор NOVA_DATA.competitions из data/data.js остаётся как
   офлайн-фолбэк: если API недоступен, сайт продолжает показывать
   контент (но подача заявки требует сервера).

   NOVACompetitions.load()        — подтянуть актуальные данные,
                                    слить поверх NOVA_DATA и
                                    перерисовать страницу.
   NOVACompetitions.sync()        — то же, но без перерисовки.
   NOVACompetitions.get(slug)     — текущий объект соревнования
   NOVACompetitions.participants(slug) — публичный список участников
   ============================================================ */

window.NOVACompetitions = (function () {

  let loaded = false;
  const listeners = [];

  function mergeIntoDemo(list) {
    if (!Array.isArray(list) || !window.NOVA_DATA) return;
    NOVA_DATA.competitions = list;
    loaded = true;
  }

  /** Fetch fresh competitions; resolves to true when fresh data applied. */
  async function refresh() {
    const data = await NOVA_API.get('/api/competitions');
    if (data && Array.isArray(data.competitions)) {
      mergeIntoDemo(data.competitions);
      loaded = true;
      return true;
    }
    return false;
  }

  /**
   * Load fresh data, then re-run the page renderers that subscribed
   * via NOVACompetitions.onRefresh(fn). Pages call this on startup:
   * they render immediately from demo data (no blank screen), and the
   * numbers/titles refresh the moment the server answers.
   */
  async function load() {
    try {
      const fresh = await refresh();
      if (fresh) listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    } catch (e) {
      /* offline / server error — demo data stays, no crash */
      console.warn('NOVACompetitions: using fallback demo data', e && e.code);
    }
  }

  function get(slug) {
    return (window.NOVA && NOVA.competition(slug)) || null;
  }

  async function participants(slug) {
    const data = await NOVA_API.get(`/api/competitions/${encodeURIComponent(slug)}/participants`);
    return (data && data.participants) || [];
  }

  return {
    load,
    sync: refresh,
    get,
    participants,
    onRefresh(fn) { if (typeof fn === 'function') listeners.push(fn); },
    get isLoaded() { return loaded; },
  };
})();
