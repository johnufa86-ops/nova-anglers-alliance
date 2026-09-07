/* ============================================================
   NOVA ANGLERS ALLIANCE — ADMIN SESSION LAYER
   ============================================================
   Авторизация кабинета организатора: email + password →
   серверная сессия в httpOnly-cookie. JS не видит сам токен.

   NOVAAdmin.me()               — текущий пользователь | null
   NOVAAdmin.login(email, pass) — { user } | throw
   NOVAAdmin.logout()
   NOVAAdmin.can(...actions)    — проверка роли на клиенте
                                  (сервер всё равно проверяет сам)
   ============================================================ */

window.NOVAAdmin = (function () {

  async function me() {
    try {
      const data = await NOVA_API.get('/api/auth/me');
      return (data && data.user) || null;
    } catch (e) {
      return null;
    }
  }

  async function login(email, password) {
    const data = await NOVA_API.post('/api/auth/login', { email, password });
    return (data && data.user) || null;
  }

  async function logout() {
    try { await NOVA_API.post('/api/auth/logout', {}); } catch (e) { /* ignore */ }
  }

  function can(user, action) {
    if (!user) return false;
    const r = user.role;
    switch (action) {
      case 'view': return ['admin', 'organizer', 'viewer'].includes(r);
      case 'review': return ['admin', 'organizer'].includes(r);   // смена статусов
      case 'export': return ['admin', 'organizer'].includes(r);   // выгрузки
      default: return false;
    }
  }

  const ROLE_LABELS = { admin: 'Администратор', organizer: 'Организатор', viewer: 'Наблюдатель' };

  return { me, login, logout, can, ROLE_LABELS };
})();
