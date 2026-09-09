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
  statTournaments: '5',
  statRegions: '0',
};

export type HomeSettings = typeof DEFAULT_HOME_SETTINGS;

export const DEFAULT_CONTACTS_SETTINGS = {
  phone: '+7 (800) 555-01-01',
  emailGeneral: 'info@nova-anglers.ru',
  emailPartners: 'partners@nova-anglers.ru',
  emailMedia: 'media@nova-anglers.ru',
  address: 'г. Москва · NOVA ANGLERS ALLIANCE HQ',
  workingHours: 'Пн–Пт: 09:00 — 19:00 (МСК)',
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
