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
  competitions: [
    {
      id: 'nova-street-river-ufa-2026',
      slug: 'nova-street-river-ufa-2026',
      title: 'NOVA Street & River — Уфа 2026',
      shortTitle: 'NOVA Street & River Уфа',
      stage: 'upcoming',
      registration: 'open',
      discipline: 'shore',
      disciplineLabel: 'Береговой спиннинг',
      region: 'Республика Башкортостан',
      place: 'г. Уфа, секретная акватория (раскрытие за 7 дней)',
      dateStart: '2026-10-10',
      dateEnd: '2026-10-10',
      dateLabel: '10 октября 2026',
      participants: 0,
      participantsLimit: 60,
      entryType: 'individual',
      fee: 2000,
      prizeFund: '50% от взносов + кубки и подарки спонсоров',
      format: 'Личный зачёт, 3 тура по 1 часу (плей-офф)',
      days: 1,
      organizer: 'NOVA Anglers Alliance',
      contact: 'info@nova-anglers.ru',
      pointsMultiplier: '×1.0',
      description: 'Первый масштабный осенний фестиваль берегового спиннинга в Уфе. Уникальный динамичный формат — 3 тура по 1 часу на выбывание (плей-офф), честная спортивная борьба в наколотой зоне, строгий принцип «Поймал — Отпусти» и прямой денежный призовой фонд за 1, 2 и 3 места!',
      regulations: [
        {
          h: '1. Формат и тайминг турнира',
          p: 'Фестиваль проводится в 3 тура продолжительностью по 1 часу каждый по системе плей-офф (на выбывание).',
          list: [
            '1 ТУР (Квалификация, 1 час): старт всех участников. Нижняя треть выбывает.',
            '2 ТУР (Полуфинал, 1 час): борьба в уже наколотой и запрессованной зоне. Выбывает ещё треть от начального состава.',
            '3 ТУР (Золотой Финал, 1 час): ТОП сильнейших рыболовов сходятся в решающей битве за пьедестал!'
          ]
        },
        {
          h: '2. Подсчёт результатов и зачёт рыбы',
          p: 'Зачёт ведётся по общей длине рыбы (от кончика рыла до конца лучей хвостового плавника).',
          list: [
            'В каждом туре к зачёту принимается не более 5 самых длинных рыб.',
            'Итоговый результат тура — сумма длин зачётных рыб.',
            'К зачёту принимаются хищные виды рыб: щука, судак, окунь, жерех, голавль, язь.'
          ]
        },
        {
          h: '3. Принцип «Поймал — Отпусти» (Catch & Release)',
          p: 'Бережное отношение к ихтиофауне — ключевой спортивный приоритет NOVA.',
          list: [
            'Каждый участник обязан иметь при себе индивидуальную ёмкость с водой (ведро/кан) для сохранения рыбы живой до замера.',
            'Линейный судья производит фиксацию длины на официальной влажной измерительной линейке, после чего рыба немедленно отпускается.',
            'Снулая или сильно повреждённая рыба к зачёту не принимается.'
          ]
        },
        {
          h: '4. Призовой фонд и специальные номинации',
          p: 'Ровно 50% всех регистрационных взносов формируют денежный призовой фонд за 1, 2 и 3 места.',
          list: [
            '🥇 1 место — Кубок + Денежный приз + Подарки партнёров',
            '🥈 2 место — Кубок + Денежный приз + Подарки партнёров',
            '🥉 3 место — Кубок + Денежный приз + Подарки партнёров',
            '🦈 Big Fish турнира — приз за самую крупную рыбу',
            '🔍 Micro Fish — приз за самого маленького зачётного окуня',
            '👦 Самый юный спиннингист — поддержка молодого поколения',
            '👩 Lady Angler — приз лучшей девушке-рыболову',
            '🎟️ Лотерея по номерам — розыгрыш ценных призов среди участников, выбывших в 1 и 2 турах'
          ]
        },
        {
          h: '5. Регистрация и участие',
          p: 'Взнос за участие составляет 2 000 ₽. Количество мест ограничено: 60 слотов.',
          list: [
            'Подача заявки: через официальную группу ВКонтакте (vk.me/nova_anglers) или по почте info@nova-anglers.ru.',
            'В заявке указываются: ФИО, город и контактный телефон спортсмена.'
          ]
        }
      ],
      documents: [
        { name: 'Регламент NOVA Street & River Уфа 2026', type: 'PDF' },
        { name: 'Положение о безопасности на водоёме', type: 'PDF' }
      ]
    }
  ],

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
