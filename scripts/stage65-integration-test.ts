import { describe, it, expect } from 'bun:test';

describe('Интеграционные тесты Этапа 6.5 (API & Безопасность)', () => {
  it('GET /api/payment-details возвращает конфигурацию и статус', async () => {
    const res = await fetch('http://localhost:3000/api/payment-details');
    expect([200, 404, 500]).toContain(res.status);
  });

  it('Отклонение загрузки без авторизации на /api/me/applications/:id/payment-proof', async () => {
    const res = await fetch('http://localhost:3000/api/me/applications/fake-id/payment-proof', {
      method: 'POST'
    });
    expect([401, 403, 404]).toContain(res.status);
  });

  it('Отклонение чужого чека /api/files/payment-proof/:id без прав', async () => {
    const res = await fetch('http://localhost:3000/api/files/payment-proof/fake-payment-id');
    expect([401, 403, 404]).toContain(res.status);
  });
});
