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
      id: 'nova-cup-volga',
      title: 'NOVA CUP — Волга. Кубок открытия сезона',
      shortTitle: 'NOVA CUP — Волга',
      stage: 'upcoming',
      registration: 'open',
      dateLabel: '13–15 июня 2026',
      dateStart: '2026-06-13',
      dateEnd: '2026-06-15',
      region: 'Юг России',
      place: 'Астраханская область',
      discipline: 'spin',
      disciplineLabel: 'Спиннинг, лодка',
      format: 'Экипажи, 2 спортсмена',
      entryType: 'team',
      organizer: 'NOVA Anglers Alliance',
      contact: 'volga@nova-anglers.ru',
      participants: 68,
      participantsLimit: 80,
      prizeFund: '2 000 000 ₽',
      days: 3,
      pointsMultiplier: '×1.5',
      description: 'NOVA CUP — Волга традиционно открывает соревновательный сезон Альянса. Экипажи из 12 регионов встретятся на воде Астраханской области — одном из самых техничных и рыбных полигонов страны. Турнир входит в основной зачёт рейтинга NOVA и даёт максимальное количество очков среди этапов открытия.',
      regulations: [
        { h: 'Формат зачёта', p: 'Соревнования проводятся в экипажном зачёте — два спортсмена на одной лодке. Итоговый результат экипажа определяется суммарным весом зачётных рыб за три дня.' },
        { h: 'Зачётные виды', list: ['Судак — от 40 см', 'Щука — от 50 см', 'Окунь — от 25 см'] },
        { h: 'Начисление очков в рейтинг NOVA', p: 'Очки начисляются по итоговому месту экипажа и статусу турнира. NOVA CUP — Волга имеет статус этапа первой категории — коэффициент начисления ×1.5.' },
      ],
      documents: [
        { name: 'Положение о турнире', type: 'PDF' },
        { name: 'Регламент соревнований', type: 'PDF' },
        { name: 'Карта акватории', type: 'PDF' },
      ],
      participantsList: [],
      results: [],
      media: ['Сборы экипажей', 'Карта акватории', 'Открытие сезона'],
    },
    {
      id: 'bereg-rossii-1',
      title: 'Берег России — этап 1',
      shortTitle: 'Берег России — этап 1',
      stage: 'upcoming',
      registration: 'open',
      dateLabel: '27 июня 2026',
      dateStart: '2026-06-27',
      dateEnd: '2026-06-27',
      region: 'Северо-Запад',
      place: 'Ленинградская область',
      discipline: 'shore',
      disciplineLabel: 'Берег',
      format: 'Личный зачёт',
      entryType: 'individual',
      organizer: 'NOVA Anglers Alliance',
      contact: 'shore@nova-anglers.ru',
      participants: 40,
      participantsLimit: 60,
      prizeFund: '600 000 ₽',
      days: 1,
      pointsMultiplier: '×1.0',
      description: 'Первый этап берегового кубка сезона. Личный зачёт, ловля со стационарных точек побережья Финского залива.',
      regulations: [
        { h: 'Формат зачёта', p: 'Личный зачёт, одна зона на спортсмена, жеребьёвка секторов в день старта.' },
      ],
      documents: [{ name: 'Регламент соревнований', type: 'PDF' }],
      participantsList: [],
      results: [],
      media: ['Побережье залива'],
    },
    {
      id: 'nova-don-summer',
      title: 'NOVA Дон — летний рубеж',
      shortTitle: 'NOVA Дон — летний рубеж',
      stage: 'upcoming',
      registration: 'open',
      dateLabel: '11 июля 2026',
      dateStart: '2026-07-11',
      dateEnd: '2026-07-11',
      region: 'Юг России',
      place: 'Ростовская область',
      discipline: 'boat',
      disciplineLabel: 'Лодка',
      format: 'Экипажи, 2 спортсмена',
      entryType: 'team',
      organizer: 'NOVA Anglers Alliance',
      contact: 'don@nova-anglers.ru',
      participants: 52,
      participantsLimit: 70,
      prizeFund: '1 200 000 ₽',
      days: 1,
      pointsMultiplier: '×1.2',
      description: 'Летний этап на Дону — техничная короткая дистанция, важный рубеж перед серединой сезона.',
      regulations: [{ h: 'Формат зачёта', p: 'Экипажный зачёт, один соревновательный день.' }],
      documents: [{ name: 'Регламент соревнований', type: 'PDF' }],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'kubok-kaspiya',
      title: 'Кубок Каспия',
      shortTitle: 'Кубок Каспия',
      stage: 'upcoming',
      registration: 'soon',
      dateLabel: '25 июля 2026',
      dateStart: '2026-07-25',
      dateEnd: '2026-07-25',
      region: 'Юг России',
      place: 'Дагестан',
      discipline: 'spin',
      disciplineLabel: 'Спиннинг, другие виды',
      format: 'Личный зачёт',
      entryType: 'individual',
      organizer: 'NOVA Anglers Alliance',
      contact: 'kaspiy@nova-anglers.ru',
      participants: 21,
      participantsLimit: 60,
      prizeFund: '800 000 ₽',
      days: 1,
      pointsMultiplier: '×1.0',
      description: 'Квалификационный этап южного побережья Каспия, открыт для личного зачёта.',
      regulations: [{ h: 'Формат зачёта', p: 'Личный зачёт, квалификация в один день.' }],
      documents: [],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'nova-fly-karelia',
      title: 'NOVA Fly — мушка и нахлыст',
      shortTitle: 'NOVA Fly — Карелия',
      stage: 'upcoming',
      registration: 'soon',
      dateLabel: '8 августа 2026',
      dateStart: '2026-08-08',
      dateEnd: '2026-08-08',
      region: 'Северо-Запад',
      place: 'Карелия',
      discipline: 'other',
      disciplineLabel: 'Нахлыст',
      format: 'Личный зачёт',
      entryType: 'individual',
      organizer: 'NOVA Anglers Alliance',
      contact: 'fly@nova-anglers.ru',
      participants: 18,
      participantsLimit: 40,
      prizeFund: '400 000 ₽',
      days: 1,
      pointsMultiplier: '×0.8',
      description: 'Нишевый этап для нахлыстовиков на карельских озёрах.',
      regulations: [{ h: 'Формат зачёта', p: 'Личный зачёт, ловля исключительно нахлыстом.' }],
      documents: [],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'sever-bereg-final',
      title: 'Северный берег — финал этапа',
      shortTitle: 'Северный берег — финал',
      stage: 'upcoming',
      registration: 'closed',
      dateLabel: '22 августа 2026',
      dateStart: '2026-08-22',
      dateEnd: '2026-08-22',
      region: 'Северо-Запад',
      place: 'Мурманская область',
      discipline: 'shore',
      disciplineLabel: 'Берег',
      format: 'Личный зачёт',
      entryType: 'individual',
      organizer: 'NOVA Anglers Alliance',
      contact: 'sever@nova-anglers.ru',
      participants: 60,
      participantsLimit: 60,
      prizeFund: '700 000 ₽',
      days: 1,
      pointsMultiplier: '×1.0',
      description: 'Финал берегового кубка Северо-Запада, регистрация закрыта — лимит участников достигнут.',
      regulations: [{ h: 'Формат зачёта', p: 'Личный зачёт по итогам серии из трёх этапов.' }],
      documents: [],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'nova-ural-trofi',
      title: 'NOVA Урал — трофи-серия',
      shortTitle: 'NOVA Урал — трофи-серия',
      stage: 'upcoming',
      registration: 'open',
      dateLabel: '5 сентября 2026',
      dateStart: '2026-09-05',
      dateEnd: '2026-09-05',
      region: 'Урал и Сибирь',
      place: 'Свердловская область',
      discipline: 'boat',
      disciplineLabel: 'Лодка, спиннинг',
      format: 'Экипажи, 2 спортсмена',
      entryType: 'team',
      organizer: 'NOVA Anglers Alliance',
      contact: 'ural@nova-anglers.ru',
      participants: 24,
      participantsLimit: 50,
      prizeFund: '900 000 ₽',
      days: 1,
      pointsMultiplier: '×1.0',
      description: 'Трофи-формат на уральских водохранилищах, экипажный зачёт.',
      regulations: [{ h: 'Формат зачёта', p: 'Экипажный зачёт, трофи-формат — засчитывается только самая крупная рыба дня.' }],
      documents: [],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'kubok-sibiri',
      title: 'Кубок Сибири',
      shortTitle: 'Кубок Сибири',
      stage: 'upcoming',
      registration: 'soon',
      dateLabel: '19 сентября 2026',
      dateStart: '2026-09-19',
      dateEnd: '2026-09-19',
      region: 'Урал и Сибирь',
      place: 'Новосибирская область',
      discipline: 'shore',
      disciplineLabel: 'Берег',
      format: 'Личный зачёт',
      entryType: 'individual',
      organizer: 'NOVA Anglers Alliance',
      contact: 'sibir@nova-anglers.ru',
      participants: 15,
      participantsLimit: 50,
      prizeFund: '500 000 ₽',
      days: 1,
      pointsMultiplier: '×1.0',
      description: 'Осенний береговой этап сибирского региона.',
      regulations: [{ h: 'Формат зачёта', p: 'Личный зачёт, один соревновательный день.' }],
      documents: [],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'nova-final-astrakhan',
      title: 'NOVA Финал — Астрахань',
      shortTitle: 'NOVA Финал — Астрахань',
      stage: 'upcoming',
      registration: 'closed',
      dateLabel: '3 октября 2026',
      dateStart: '2026-10-03',
      dateEnd: '2026-10-05',
      region: 'Юг России',
      place: 'Астраханская область',
      discipline: 'boat',
      disciplineLabel: 'Лодка',
      format: 'Экипажи, 2 спортсмена',
      entryType: 'team',
      organizer: 'NOVA Anglers Alliance',
      contact: 'final@nova-anglers.ru',
      participants: 32,
      participantsLimit: 32,
      prizeFund: '3 000 000 ₽',
      days: 3,
      pointsMultiplier: '×2.0',
      description: 'Финал сезона 2026 — участвуют только 32 лучших экипажа по итогам года. Регистрация закрыта, состав определён рейтингом.',
      regulations: [{ h: 'Формат зачёта', p: 'Финальная серия, экипажный зачёт, коэффициент начисления очков ×2.' }],
      documents: [{ name: 'Регламент финала', type: 'PDF' }],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'nova-caspian-live',
      title: 'NOVA Каспий — Live Cup',
      shortTitle: 'NOVA Каспий — Live Cup',
      stage: 'live',
      registration: 'closed',
      dateLabel: 'Идёт сейчас · день 2 из 3',
      dateStart: '2026-08-30',
      dateEnd: '2026-09-01',
      region: 'Юг России',
      place: 'Дагестан',
      discipline: 'spin',
      disciplineLabel: 'Спиннинг, лодка',
      format: 'Экипажи, 2 спортсмена',
      entryType: 'team',
      organizer: 'NOVA Anglers Alliance',
      contact: 'kaspiy@nova-anglers.ru',
      participants: 44,
      participantsLimit: 44,
      prizeFund: '1 500 000 ₽',
      days: 3,
      pointsMultiplier: '×1.3',
      description: 'Турнир проходит прямо сейчас на побережье Каспия. Промежуточные результаты обновляются по итогам каждого дня.',
      regulations: [{ h: 'Формат зачёта', p: 'Экипажный зачёт, суммарный вес за три дня.' }],
      documents: [],
      participantsList: [],
      results: [],
      media: [],
    },
    {
      id: 'nova-don-winter',
      title: 'NOVA CUP — Дон',
      shortTitle: 'NOVA CUP — Дон',
      stage: 'finished',
      registration: 'closed',
      dateLabel: '08–10 марта 2026',
      dateStart: '2026-03-08',
      dateEnd: '2026-03-10',
      region: 'Юг России',
      place: 'Ростовская область',
      discipline: 'boat',
      disciplineLabel: 'Лодка, спиннинг',
      format: 'Личный и экипажный зачёт',
      entryType: 'both',
      organizer: 'NOVA Anglers Alliance',
      contact: 'don@nova-anglers.ru',
      participants: 210,
      participantsLimit: 210,
      prizeFund: '2 500 000 ₽',
      days: 3,
      pointsMultiplier: '×1.5',
      description: '210 спортсменов, 3 дня борьбы — финальный этап зимней серии NOVA. Турнир завершён, протокол опубликован.',
      regulations: [{ h: 'Формат зачёта', p: 'Смешанный зачёт: личный рейтинг спортсменов и отдельный зачёт экипажей.' }],
      documents: [
        { name: 'Итоговый протокол', type: 'PDF' },
        { name: 'Положение о турнире', type: 'PDF' },
      ],
      participantsList: [],
      results: [],
      media: ['Финал, день 3', 'Награждение', 'Рассвет на Дону'],
    },
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
  news: [
    { id: 'reg-open-volga', date: '24.02.2026', category: 'Анонс', title: 'Открыта регистрация на NOVA CUP — Волга',
      excerpt: 'Первый старт сезона 2026 пройдёт в Астраханской области 13–15 июня. Регистрация экипажей уже открыта.',
      body: 'Первый старт сезона 2026 пройдёт в Астраханской области 13–15 июня. Регистрация экипажей уже открыта на сайте Альянса — количество мест ограничено. NOVA CUP — Волга традиционно задаёт тон всему сезону и даёт повышенный коэффициент начисления очков в общий рейтинг.',
      competitionId: 'nova-cup-volga' },
    { id: 'calendar-expand', date: '02.02.2026', category: 'Альянс', title: 'NOVA расширяет календарь соревнований',
      excerpt: 'В сезоне 2026 утверждены этапы в ключевых рыболовных регионах страны.',
      body: 'В сезоне 2026 утверждены этапы на Волге, Дону, Финском заливе и Каспии. Это расширяет географию Альянса и объединяет сильнейшие рыболовные локации страны.' },
    { id: 'regulations-2026', date: '27.01.2026', category: 'Соревнования', title: 'Утверждён регламент сезона 2026',
      excerpt: 'Обновлены правила начисления очков и зачётные виды рыб для всех дисциплин.',
      body: 'Обновлены правила начисления очков и зачётные виды рыб для всех дисциплин. Полный текст регламента доступен на странице каждого турнира.' },
  ],

  /* ------------------------------------------------------------
     MEDIA TILES  (demo — labels + linked competition)
  ------------------------------------------------------------ */
  media: [
    { label: 'NOVA CUP — Волга',        type: 'photo', competitionId: 'nova-cup-volga' },
    { label: 'Берег России',            type: 'photo', competitionId: 'bereg-rossii-1' },
    { label: 'NOVA Дон — летний рубеж', type: 'photo', competitionId: 'nova-don-summer' },
    { label: 'Кубок Каспия',            type: 'photo', competitionId: 'kubok-kaspiya' },
    { label: 'Рассвет на Волге',        type: 'photo', competitionId: 'nova-cup-volga' },
    { label: 'Акватория соревнований',  type: 'video', competitionId: 'nova-cup-volga' },
    { label: 'Сборы экипажей',          type: 'photo', competitionId: 'nova-cup-volga' },
  ],

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
