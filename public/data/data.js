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
      participantsList: [
        { teamId: 'meridian', status: 'confirmed' },
        { teamId: 'nordwest', status: 'confirmed' },
        { teamId: 'azimut', status: 'confirmed' },
        { teamId: 'delta', status: 'pending' },
      ],
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
      participantsList: [
        { athleteId: 'krylova', status: 'confirmed' },
        { athleteId: 'bykova', status: 'confirmed' },
      ],
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
      participantsList: [{ teamId: 'delta', status: 'confirmed' }],
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
      participantsList: [{ athleteId: 'titov', status: 'confirmed' }],
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
      participantsList: [{ athleteId: 'bykova', status: 'confirmed' }],
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
      participantsList: [{ athleteId: 'krylova', status: 'confirmed' }],
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
      participantsList: [{ teamId: 'saturn', status: 'confirmed' }],
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
      participantsList: [{ athleteId: 'panov', status: 'confirmed' }],
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
      participantsList: [{ teamId: 'meridian', status: 'confirmed' }, { teamId: 'nordwest', status: 'confirmed' }],
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
      participantsList: [
        { teamId: 'azimut', status: 'confirmed' },
        { teamId: 'polyaris', status: 'confirmed' },
      ],
      results: [
        { place: 1, teamId: 'azimut', score: '18.4 кг', novaPoints: '—' },
        { place: 2, teamId: 'polyaris', score: '16.9 кг', novaPoints: '—' },
      ],
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
      participantsList: [
        { athleteId: 'volkov', status: 'confirmed' },
        { teamId: 'meridian', status: 'confirmed' },
        { athleteId: 'shakhov', status: 'confirmed' },
        { athleteId: 'sokolova', status: 'confirmed' },
        { teamId: 'nordwest', status: 'confirmed' },
      ],
      results: [
        { place: 1, athleteId: 'volkov', score: '24.8 кг', novaPoints: 720 },
        { place: 2, teamId: 'meridian', score: '24.1 кг', novaPoints: 640 },
        { place: 3, athleteId: 'shakhov', score: '23.9 кг', novaPoints: 590 },
        { place: 4, athleteId: 'sokolova', score: '23.0 кг', novaPoints: 520 },
        { place: 5, teamId: 'nordwest', score: '22.6 кг', novaPoints: 470 },
      ],
      media: ['Финал, день 3', 'Награждение', 'Рассвет на Дону'],
    },
  ],

  /* ------------------------------------------------------------
     ATHLETES
  ------------------------------------------------------------ */
  athletes: [
    { id: 'volkov',   name: 'Артём Волков',   initials: 'АВ', region: 'Ростовская обл.',      teamId: 'meridian', rating: 2480, competitions: 7, wins: 3, podiums: 5,
      bio: 'Действующий лидер рейтинга NOVA, выступает за экипаж «Меридиан». В спортивной рыбалке с 2018 года, в системе NOVA — с момента основания Альянса. Специализируется на спиннинговой ловле судака и щуки с лодки.',
      history: [
        { competitionId: 'nova-don-winter', place: 1, result: '24.8 кг', points: 720 },
        { competitionId: 'nova-cup-volga',  place: 2, result: '21.3 кг', points: 640, demo: true },
      ] },
    { id: 'shakhov',  name: 'Игорь Шахов',    initials: 'ИШ', region: 'Волгоградская обл.',    teamId: null, rating: 2390, competitions: 6, wins: 2, podiums: 4,
      bio: 'Спортсмен-одиночка, выступает в личном зачёте с 2021 года. Специализация — джиговая ловля судака.',
      history: [ { competitionId: 'nova-don-winter', place: 3, result: '23.9 кг', points: 590 } ] },
    { id: 'sokolova', name: 'Дарья Соколова', initials: 'ДС', region: 'Астраханская обл.',     teamId: null, rating: 2301, competitions: 6, wins: 1, podiums: 4,
      bio: 'Одна из сильнейших спортсменок NOVA, специалист по ловле с лодки на дальней дистанции.',
      history: [ { competitionId: 'nova-don-winter', place: 4, result: '23.0 кг', points: 520 } ] },
    { id: 'egorov',   name: 'Максим Егоров',  initials: 'МЕ', region: 'Краснодарский край',    teamId: 'meridian', rating: 2214, competitions: 5, wins: 1, podiums: 3, bio: 'Второй номер экипажа «Меридиан».', history: [] },
    { id: 'vetrova',  name: 'Полина Ветрова', initials: 'ПВ', region: 'Ленинградская обл.',    teamId: 'nordwest', rating: 2170, competitions: 6, wins: 1, podiums: 3, bio: 'Капитан экипажа «Нордвест», специализация — береговая ловля.', history: [] },
    { id: 'gromov',   name: 'Никита Громов',  initials: 'НГ', region: 'Свердловская обл.',     teamId: 'saturn',   rating: 2098, competitions: 5, wins: 0, podiums: 2, bio: 'Выступает за экипаж «Сатурн», участник трофи-серии Урала.', history: [] },
    { id: 'panov',    name: 'Сергей Панов',   initials: 'СП', region: 'Новосибирская обл.',    teamId: null,       rating: 2041, competitions: 4, wins: 0, podiums: 1, bio: 'Представитель сибирского региона в личном зачёте.', history: [] },
    { id: 'krylova',  name: 'Елена Крылова',  initials: 'ЕК', region: 'Мурманская обл.',       teamId: null,       rating: 1985, competitions: 5, wins: 0, podiums: 2, bio: 'Специалист берегового направления Северо-Запада.', history: [] },
    { id: 'titov',    name: 'Роман Титов',    initials: 'РТ', region: 'Дагестан',              teamId: 'azimut',   rating: 1922, competitions: 4, wins: 0, podiums: 1, bio: 'Представитель южного побережья Каспия, экипаж «Азимут».', history: [] },
    { id: 'bykova',   name: 'Ольга Быкова',   initials: 'ОБ', region: 'Карелия',               teamId: null,       rating: 1870, competitions: 3, wins: 0, podiums: 1, bio: 'Участница нишевых нахлыстовых этапов Карелии.', history: [] },
  ],

  /* ------------------------------------------------------------
     TEAMS  — type: 'crew' (экипаж) | 'club' (клуб)
  ------------------------------------------------------------ */
  teams: [
    { id: 'meridian', type: 'crew', name: 'Экипаж «Меридиан»', initials: 'МР', region: 'Краснодарский край', rating: 4820, competitions: 8, athleteIds: ['volkov', 'egorov'] },
    { id: 'nordwest', type: 'crew', name: 'Экипаж «Нордвест»', initials: 'НВ', region: 'Ленинградская обл.', rating: 4695, competitions: 7, athleteIds: ['vetrova'] },
    { id: 'azimut',   type: 'crew', name: 'Экипаж «Азимут»',   initials: 'АЗ', region: 'Астраханская обл.',  rating: 4560, competitions: 7, athleteIds: ['titov'] },
    { id: 'delta',    type: 'crew', name: 'Экипаж «Дельта»',   initials: 'ДЛ', region: 'Ростовская обл.',    rating: 4410, competitions: 6, athleteIds: [] },
    { id: 'farvater', type: 'crew', name: 'Экипаж «Фарватер»', initials: 'ФВ', region: 'Волгоградская обл.', rating: 4288, competitions: 6, athleteIds: [] },
    { id: 'polyaris', type: 'crew', name: 'Экипаж «Полярис»',  initials: 'ПЛ', region: 'Мурманская обл.',    rating: 4110, competitions: 5, athleteIds: [] },
    { id: 'saturn',   type: 'crew', name: 'Экипаж «Сатурн»',   initials: 'СТ', region: 'Свердловская обл.',  rating: 3980, competitions: 5, athleteIds: ['gromov'] },

    { id: 'volga-sport',   type: 'club', name: 'Клуб «Волга Спорт»',     initials: 'ВС', region: 'Волгоград',        rating: 12840, competitions: 14, athleteIds: [] },
    { id: 'don-angl',      type: 'club', name: 'Клуб «Дон Англ»',        initials: 'ДА', region: 'Ростов-на-Дону',   rating: 11920, competitions: 12, athleteIds: ['shakhov'] },
    { id: 'kaspiy-pro',    type: 'club', name: 'Клуб «Каспий Про»',      initials: 'КП', region: 'Астрахань',        rating: 11480, competitions: 13, athleteIds: ['sokolova'] },
    { id: 'sever-bereg',   type: 'club', name: 'Клуб «Северный берег»',  initials: 'СБ', region: 'Мурманск',         rating: 10650, competitions: 10, athleteIds: ['krylova'] },
    { id: 'meridian-club', type: 'club', name: 'Клуб «Меридиан»',        initials: 'КМ', region: 'Краснодар',        rating: 9870,  competitions: 9,  athleteIds: [] },
  ],

  /* ------------------------------------------------------------
     NEWS
  ------------------------------------------------------------ */
  news: [
    { id: 'reg-open-volga', date: '24.02.2026', category: 'Анонс', title: 'Открыта регистрация на NOVA CUP — Волга',
      excerpt: 'Первый старт сезона 2026 пройдёт в Астраханской области 13–15 июня. Регистрация экипажей уже открыта.',
      body: 'Первый старт сезона 2026 пройдёт в Астраханской области 13–15 июня. Регистрация экипажей уже открыта на сайте Альянса — количество мест ограничено. NOVA CUP — Волга традиционно задаёт тон всему сезону и даёт повышенный коэффициент начисления очков в общий рейтинг.',
      competitionId: 'nova-cup-volga' },
    { id: 'interview-volkov', date: '18.02.2026', category: 'Интервью', title: 'Артём Волков — о победе в зимней серии',
      excerpt: 'Лидер рейтинга NOVA рассказал о подготовке к сезону и планах на международные старты.',
      body: 'Лидер рейтинга NOVA рассказал о подготовке к сезону и планах на международные старты. Артём отметил, что ключевую роль в победе на NOVA CUP — Дон сыграла слаженная работа с напарником по экипажу «Меридиан».',
      athleteId: 'volkov' },
    { id: 'results-don', date: '10.03.2026', category: 'Результаты', title: 'Итоги NOVA CUP — Дон',
      excerpt: '210 спортсменов, 3 дня борьбы — полный протокол финального этапа зимней серии.',
      body: '210 спортсменов, 3 дня борьбы — полный протокол финального этапа зимней серии опубликован. Первое место у Артёма Волкова, второе — у экипажа «Меридиан».',
      competitionId: 'nova-don-winter' },
    { id: 'calendar-expand', date: '02.02.2026', category: 'Альянс', title: 'NOVA расширяет календарь до 19 турниров',
      excerpt: 'В сезоне 2026 добавлены два новых этапа в Карелии и Дагестане.',
      body: 'В сезоне 2026 добавлены два новых этапа в Карелии и Дагестане — NOVA Fly и Кубок Каспия. Это расширяет географию Альянса до 12 регионов.' },
    { id: 'regulations-2026', date: '27.01.2026', category: 'Соревнования', title: 'Утверждён регламент сезона 2026',
      excerpt: 'Обновлены правила начисления очков и зачётные виды рыб для всех дисциплин.',
      body: 'Обновлены правила начисления очков и зачётные виды рыб для всех дисциплин. Полный текст регламента доступен на странице каждого турнира.' },
    { id: 'meridian-rise', date: '14.01.2026', category: 'Интервью', title: 'Экипаж «Меридиан»: путь к вершине рейтинга',
      excerpt: 'Как молодой экипаж из Краснодарского края поднялся на первое место в зачёте экипажей.',
      body: 'Как молодой экипаж из Краснодарского края поднялся на первое место в зачёте экипажей — история становления команды «Меридиан».',
      teamId: 'meridian' },
  ],

  /* ------------------------------------------------------------
     MEDIA TILES  (demo — labels + linked competition)
  ------------------------------------------------------------ */
  media: [
    { label: 'NOVA CUP — Дон',          type: 'photo', competitionId: 'nova-don-winter' },
    { label: 'Финал, день 3',           type: 'video', competitionId: 'nova-don-winter' },
    { label: 'Берег России',            type: 'photo', competitionId: 'bereg-rossii-1' },
    { label: 'Интервью лидера',         type: 'video', athleteId: 'volkov' },
    { label: 'Кубок Каспия',            type: 'photo', competitionId: 'kubok-kaspiya' },
    { label: 'Экипаж «Меридиан»',       type: 'photo', teamId: 'meridian' },
    { label: 'Награждение',             type: 'video', competitionId: 'nova-don-winter' },
    { label: 'Рассвет на Волге',        type: 'photo', competitionId: 'nova-cup-volga' },
    { label: 'NOVA Fly, Карелия',       type: 'photo', competitionId: 'nova-fly-karelia' },
    { label: 'Трансляция старта',       type: 'video', competitionId: 'nova-caspian-live' },
    { label: 'Сборы экипажей',          type: 'photo', competitionId: 'nova-cup-volga' },
    { label: 'Северный берег',          type: 'photo', competitionId: 'sever-bereg-final' },
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
