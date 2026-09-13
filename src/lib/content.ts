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
