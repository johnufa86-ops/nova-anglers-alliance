import { describe, it, expect } from 'bun:test';
import { calculatePointsForPlace } from '../src/config/rating';
import { validateBankDetails } from '../src/lib/bank-validation';
import { getPaymentConfig } from '../src/lib/payments-config';
import { checkRateLimit } from '../src/lib/rate-limiter';

describe('Рейтинг: Формула очков', () => {
  it('1 место = 100 очков', () => expect(calculatePointsForPlace(1, 10)).toBe(100));
  it('2 место = 80 очков', () => expect(calculatePointsForPlace(2, 10)).toBe(80));
  it('3 место = 60 очков', () => expect(calculatePointsForPlace(3, 10)).toBe(60));
  it('4-10 места = 40 очков', () => {
    for (let p = 4; p <= 10; p++) expect(calculatePointsForPlace(p, 10)).toBe(40);
  });
  it('11+ места = 10 очков', () => {
    expect(calculatePointsForPlace(11, 20)).toBe(10);
    expect(calculatePointsForPlace(49, 49)).toBe(10);
  });
  it('Бонус за массовость >= 50 участников (+20%)', () => {
    expect(calculatePointsForPlace(1, 50)).toBe(120);
    expect(calculatePointsForPlace(2, 50)).toBe(96);
    expect(calculatePointsForPlace(3, 50)).toBe(72);
    expect(calculatePointsForPlace(5, 50)).toBe(48);
    expect(calculatePointsForPlace(12, 50)).toBe(12);
  });
});

describe('Валидация банковских реквизитов', () => {
  it('Корректные данные (ИНН 10)', () => {
    const res = validateBankDetails({ accountNumber: '40802810123456789012', bik: '044525225', inn: '7701234567' });
    expect(res.isValid).toBe(true);
  });
  it('Корректные данные (ИНН 12)', () => {
    const res = validateBankDetails({ accountNumber: '40802810123456789012', bik: '044525225', inn: '770123456789' });
    expect(res.isValid).toBe(true);
  });
  it('Ошибка, если счет не 20 цифр', () => {
    const res = validateBankDetails({ accountNumber: '12345', bik: '044525225' });
    expect(res.isValid).toBe(false);
  });
  it('Ошибка, если БИК не 9 цифр', () => {
    const res = validateBankDetails({ accountNumber: '40802810123456789012', bik: '1234' });
    expect(res.isValid).toBe(false);
  });
});

describe('Rate Limiter', () => {
  it('Разрешает до 5 запросов', () => {
    const key = 'test_user_' + Date.now();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60000).allowed).toBe(true);
    }
    expect(checkRateLimit(key, 5, 60000).allowed).toBe(false);
  });
});

describe('Конфигурация флагов', () => {
  it('Корректное считывание флагов', () => {
    const cfg = getPaymentConfig();
    expect(typeof cfg.isOnlineEnabled).toBe('boolean');
    expect(typeof cfg.isBankTransferEnabled).toBe('boolean');
    expect(cfg.timeoutHours).toBeGreaterThan(0);
  });
});
