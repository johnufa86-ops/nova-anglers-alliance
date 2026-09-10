/* ============================================================
   NOVA ANGLERS ALLIANCE — DEMO DATA LAYER
   ============================================================
   Everything the site renders lives here, in one place, as plain
   JS objects on `window.NOVA_DATA`. Pages read this at runtime and
   render HTML from it — no competition/athlete/team data is ever
   hard-coded inside a page's markup.

   WHY A .js FILE AND NOT /data/*.json:
   Opening the site straight from a folder (file://) is a hard
   requirement at this stage — there's no server yet. Browsers block
   fetch()/XHR of local JSON files under file:// (CORS), so real JSON
   would silently fail outside a web server. A plain script tag has
   no such restriction and works identically once this *is* served
   over http(s).

   MOVING TO A REAL BACKEND LATER:
   Replace the body of this file with:
     window.NOVA_DATA = await (await fetch('/api/bootstrap')).json();
   ...or fetch each collection separately. Every page already reads
   exclusively from `NOVA_DATA.*` and never assumes this exact file,
   so no page/template needs to change.
   ============================================================ */

window.NOVA_DATA = {

  /* ------------------------------------------------------------
     COMPETITIONS
     stage:        'upcoming' | 'live' | 'finished'   (§2 filter)
     registration: 'open' | 'soon' | 'closed'          (card badge)
  ------------------------------------------------------------ */
  competitions: [],

  /* ------------------------------------------------------------
     ATHLETES — real data loaded from /api/athletes
  ------------------------------------------------------------ */
  athletes: [],

  /* ------------------------------------------------------------
     TEAMS  — type: 'crew' (экипаж) | 'club' (клуб)
  ------------------------------------------------------------ */
  teams: [],

  /* ------------------------------------------------------------
     NEWS
  ------------------------------------------------------------ */
  news: [],

  /* ------------------------------------------------------------
     MEDIA TILES  (demo — labels + linked competition)
  ------------------------------------------------------------ */
  media: [],

};

/* ============================================================
   Small pure helpers shared by every page's inline script.
   (Kept here, next to the data, since they only exist to read it.)
   ============================================================ */
window.NOVA = {
  byId(list, id){ return list.find(x => x.id === id) || null; },

  athlete(id){ return this.byId(NOVA_DATA.athletes, id); },
  team(id){ return this.byId(NOVA_DATA.teams, id); },
  competition(id){ return this.byId(NOVA_DATA.competitions, id); },

  stageLabel(stage){
    return { upcoming: 'Предстоит', live: 'Идёт сейчас', finished: 'Завершён' }[stage] || stage;
  },
  registrationLabel(r){
    return { open: 'Регистрация открыта', soon: 'Скоро старт', closed: 'Регистрация закрыта' }[r] || r;
  },
  disciplineLabel(d){
    return { boat: 'Лодка', shore: 'Берег', spin: 'Спиннинг', other: 'Другие' }[d] || d;
  },

  /** Resolve a participant/result row (athleteId or teamId) to a display-ready object. */
  participant(row){
    if(row.athleteId){
      const a = this.athlete(row.athleteId);
      return a ? { kind: 'athlete', id: a.id, name: a.name, sub: a.region, href: `athlete.html?id=${a.id}` } : null;
    }
    if(row.teamId){
      const t = this.team(row.teamId);
      return t ? { kind: 'team', id: t.id, name: t.name, sub: t.region, href: `team.html?id=${t.id}` } : null;
    }
    return null;
  },

  qs(name){
    return new URLSearchParams(window.location.search).get(name);
  },
};
