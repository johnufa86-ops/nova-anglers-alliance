export const DEFAULT_HOME_SETTINGS = {
  eyebrow: 'СЕЗОН 2026 — РЕГИСТРАЦИЯ ОТКРЫТА',
  title: 'Рыболовный спорт.',
  titleAccent: 'Новый уровень.',
  sub: 'NOVA Anglers Alliance объединяет спортсменов, команды и соревнования в единую рыболовную спортивную систему.',
  ctaPrimaryText: 'Ближайшие соревнования',
  ctaPrimaryUrl: '/competitions',
  ctaSecondaryText: 'Стать участником',
  ctaSecondaryUrl: '/contacts',
  statAthletes: '0',
  statCrews: '0',
  statTournaments: '0',
  statRegions: '0',
};

export type HomeSettings = typeof DEFAULT_HOME_SETTINGS;

export const DEFAULT_CONTACTS_SETTINGS = {
  phone: process.env.CONTACT_PHONE || '',
  emailGeneral: 'info@nova-anglers.ru',
  emailPartners: 'partners@nova-anglers.ru',
  emailMedia: 'media@nova-anglers.ru',
  address: '',
  workingHours: '',
  telegramUrl: 'https://t.me/nova_anglers',
  vkUrl: 'https://vk.com/nova_anglers',
  youtubeUrl: '',
};

export type ContactsSettings = typeof DEFAULT_CONTACTS_SETTINGS;

export const DEFAULT_FOOTER_SETTINGS = {
  brandDesc: 'Российская спортивная экосистема рыболовного спорта: соревнования, рейтинг, спортсмены и медиа.',
  copyright: '© 2026 NOVA Anglers Alliance. Все права защищены.',
};

export type FooterSettings = typeof DEFAULT_FOOTER_SETTINGS;

export const DEFAULT_BLOCKS_SETTINGS = {
  // Главная страница: видимость блоков
  homeHeroVisible: true,
  homeStatsVisible: true,
  homeNextCompVisible: true,
  homeLiveVisible: true,
  homeLiveTitle: 'Цифровой протокол и прямые трансляции',
  homeLiveSub: 'Рыболовный спорт нового поколения: моментальная электронная фиксация уловов по правилу No-Kill, оперативные таблицы туров и прямые эфиры с воды в официальных сообществах Альянса.',
  homeLiveBadge: 'ОНЛАЙН-СУДЕЙСТВО И МЕДИА · CATCH & RELEASE',
  homeLiveMeta: 'NOVA LIVE PROTOCOL',
  homeRatingVisible: true,
  homeAboutVisible: true,
  homeCalendarVisible: true,
  homeCalendarSub: 'Календарь турниров формируется — следите за обновлениями.',
  homeAthletesVisible: true,
  homeFinalCtaVisible: true,
  homeFinalCtaTitle: 'Готовы к новому сезону?',
  homeFinalCtaSub: 'Регистрируйтесь на соревнования, следите за рейтингом и становитесь частью всероссийского рыболовного сообщества.',
  homeFinalCtaBtnText: 'Участвовать в соревновании',
  homeFinalCtaBtnUrl: 'competitions.html',

  // Страница соревнований: видимость и тексты
  compStatsVisible: true,
  compCtaVisible: false,
  compCtaTitle: 'Хотите провести турнир NOVA в своём регионе?',
  compCtaSub: 'Подайте заявку на организацию официального этапа Альянса.',
  compCtaBtnText: 'Подать заявку',
  compCtaBtnUrl: 'contacts.html',

  // Страница Альянса: видимость и тексты
  allianceCtaVisible: true,
  allianceCtaTitle: 'Твой след в рыболовном спорте начинается здесь.',
  allianceCtaSub: 'Стань частью NOVA Anglers Alliance.',
  allianceCtaBtnText: 'Стать участником NOVA',
  allianceCtaBtnUrl: 'contacts.html',
};

export type BlocksSettings = typeof DEFAULT_BLOCKS_SETTINGS;

export const DEFAULT_PARTNERS_SETTINGS = {
  eyebrow: 'Партнёрская программа NOVA',
  title: 'Развиваем рыболовный спорт вместе',
  sub: 'Приглашаем бренды рыболовных снастей, экипировки, ритейл и медиа стать официальными партнёрами турниров и фестивалей NOVA сезона 2026.',
  slotsEyebrow: 'Сезон 2026',
  slotsTitle: 'Открытые партнёрские слоты',
  slotsSub: 'Мы создаём открытую спортивную экосистему на принципах честного спорта, динамичного формата и бережного отношения к рыбе («Поймал — Отпусти»). Выберите подходящий формат интеграции для вашего бренда.',
  slot1: 'Генеральный партнёр',
  slot2: 'Призовой фонд',
  slot3: 'Номинация «Big Fish»',
  slot4: 'Экипировка и снасти',
  slot5: 'Информационный партнёр',
  level1Title: 'Партнёр призового фонда / номинаций',
  level1Desc: 'Предоставление продукции бренда (спиннинги, катушки, шнуры, приманки) для награждения победителей. Вручение призов на церемонии, персональная интеграция в номинацию («Big Fish от [Бренд]»), фотоотчёты с продукцией в руках призёров.',
  level2Title: 'Официальный партнёр турнира',
  level2Desc: 'Размещение фирменных флагов и баннеров в стартовом городке и на подиуме награждения. Логотип на стартовых протоколах, наградной атрибутике, сайте и во всех медиа-публикациях (VK, Telegram).',
  level3Title: 'Генеральный / Титульный партнёр',
  level3Desc: 'Интеграция бренда в официальное название турнира («NOVA Street & River при поддержке [Бренд]»). Эксклюзив в товарной категории, брендинг судейской формы, фотозоны и максимальная медийная видимость.',
  ctaTitle: 'Готовы развивать рыболовный спорт вместе?',
  ctaSub: 'Свяжитесь с оргкомитетом Альянса для обсуждения условий партнёрства, специальных номинаций и медиа-интеграций в сезоне 2026.',
  ctaEmail: 'partners@nova-anglers.ru',
};

export type PartnersSettings = typeof DEFAULT_PARTNERS_SETTINGS;

export const DEFAULT_ALLIANCE_SETTINGS = {
  eyebrow: 'NOVA Anglers Alliance · Основан 12 сентября 2026 года',
  title: 'Новая культура рыболовного спорта',
  sub: 'Мы создаём открытую спортивную лигу нового поколения, объединяющую береговой спиннинг, динамичные форматы соревнований и безусловное уважение к природе.',
  val1Title: 'Честный и динамичный спорт',
  val1Desc: 'Прозрачные правила, строгий спортивный регламент, отсутствие закрытых зон и динамичные форматы туров, где решает мастерство и тактика.',
  val2Title: 'Принцип «Поймал — Отпусти»',
  val2Desc: 'Главная ценность Альянса — сохранение популяции хищной рыбы. Быстрая видеофиксация улова в воде и немедленный бережный отпуск каждого пойманного хвоста.',
  val3Title: 'Открытое сообщество',
  val3Desc: 'Равные условия для начинающих рыболовов и опытных спортсменов. Развитие доступного стритфишинга в черте города и береговой спиннинговой ловли.',
  timeline1Date: '12.09.2026',
  timeline1Title: 'Основание Альянса',
  timeline1Desc: 'Инициативная группа спиннингистов и организаторов объединилась для создания независимой спортивной лиги с современным цифровым судейством и принципом Catch & Release.',
  timeline2Date: '10.10.2026',
  timeline2Title: 'Первый фестиваль «NOVA Street & River — Уфа 2026»',
  timeline2Desc: 'Дебютный фестиваль берегового спиннинга в Уфе: 2 тура по 2 часа, честный зачёт по длине рыбы, денежный призовой фонд и призы от партнёров.',
  timeline3Date: '2027',
  timeline3Title: 'Развитие лиги и клубного рейтинга',
  timeline3Desc: 'Формирование регулярного календаря турниров, объединение рыболовных клубов Поволжья и Урала в единую рейтинговую систему NOVA.',
};

export type AllianceSettings = typeof DEFAULT_ALLIANCE_SETTINGS;

export const DEFAULT_RULES_SETTINGS = {
  eyebrow: 'Официальные правила соревнований',
  title: 'Регламент сезона 2026',
  sub: 'Единые правила проведения соревнований, подсчёта рейтинга и обеспечения спортивной честности в турнирах NOVA Anglers Alliance.',
  versionDate: 'Редакция от 14 сентября 2026 г.',
  introText: 'Настоящий Регламент определяет порядок организации и проведения спортивных соревнований по рыболовному спорту в рамках NOVA Anglers Alliance. Все участники обязаны строго соблюдать спортивную этику, правила бережного обращения с рыбой (Catch & Release) и требования безопасности на водоёме.',
  customRulesHtml: '',
};

export type RulesSettings = typeof DEFAULT_RULES_SETTINGS;

export const DEFAULT_MEDIA_SETTINGS = {
  eyebrow: 'NOVA Media',
  title: 'Соревнования. Люди. Эмоции.',
  sub: 'Фото и видео со стартов NOVA со всей страны.',
  pressBadge: 'Пресс-центр и аккредитация',
  pressTitle: 'Работа СМИ и блогеров на мероприятиях NOVA',
  pressDesc: 'Мы открыты для сотрудничества со спортивными журналистами, рыболовными медиа, операторами и блогерами. Для получения аккредитации на турниры свяжитесь с пресс-службой.',
  pressEmail: 'media@nova-anglers.ru',
};

export type MediaSettings = typeof DEFAULT_MEDIA_SETTINGS;

export const PAGE_DEFAULTS: Record<string, Record<string, any>> = {
  home: DEFAULT_HOME_SETTINGS,
  contacts: { ...DEFAULT_CONTACTS_SETTINGS, ...DEFAULT_FOOTER_SETTINGS },
  blocks: DEFAULT_BLOCKS_SETTINGS,
  partners: DEFAULT_PARTNERS_SETTINGS,
  alliance: DEFAULT_ALLIANCE_SETTINGS,
  rules: DEFAULT_RULES_SETTINGS,
  media: DEFAULT_MEDIA_SETTINGS,
};
