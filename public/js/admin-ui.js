/* ============================================================
   NOVA ANGLERS ALLIANCE — ADMIN UI SHELL
   ============================================================
   Общий каркас кабинета организатора: шапка, навигация, футер,
   проверка авторизации/ролей. Данные — через NOVAAdmin/NOVAApplications.
   ============================================================ */

window.NOVAAdminUI = (function () {

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function headerHTML(active, user) {
    const links = [
      ['/admin', 'Дашборд', 'dashboard'],
      ['/admin/applications', 'Заявки', 'applications'],
      ['/admin/content', 'Редактор главной', 'content'],
      ['/admin/payment-details', 'Реквизиты', 'payment-details'],
    ];
    return `
      <div class="wrap">
        <a href="/admin" class="logo" style="font-family:'Space Grotesk',sans-serif;font-weight:700;letter-spacing:.02em;display:flex;align-items:center;gap:10px;">
          <img src="/assets/icon-star.png" alt="NOVA" style="width:26px;height:26px;">NOVA <span style="color:var(--muted);font-weight:500;">· ОРГАНИЗАТОР</span>
        </a>
        <nav class="admin-nav">
          ${links.map(([href, label, key]) => `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="admin-user">
          <span><b>${esc(user.name)}</b> · ${esc(NOVAAdmin.ROLE_LABELS[user.role] || user.role)}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="adminLogout">Выйти</button>
        </div>
      </div>`;
  }

  function footerHTML() {
    return `
      <div class="wrap" style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <span>© 2026 NOVA Anglers Alliance · Кабинет организатора</span>
        <span><a href="/" style="color:var(--pulse-2);">← Вернуться на сайт</a></span>
      </div>`;
  }

  function mountShell(active, user) {
    const h = document.getElementById('adminHeader');
    const f = document.getElementById('adminFooter');
    if (h) h.innerHTML = headerHTML(active, user);
    if (f) f.innerHTML = footerHTML();
    const out = document.getElementById('adminLogout');
    if (out) out.addEventListener('click', async () => {
      await NOVAAdmin.logout();
      window.location.href = '/admin';
    });
  }

  /**
   * Guard for protected pages: not authed → /admin; wrong role → no-access.
   * @returns user | null
   */
  async function guard(active, actions = ['view']) {
    const user = await NOVAAdmin.me();
    if (!user) { window.location.href = '/admin'; return null; }
    const ok = actions.every((a) => NOVAAdmin.can(user, a));
    if (!ok) {
      mountShell(active, user);
      document.getElementById('adminContent').innerHTML = `
        <div class="admin-card" style="max-width:520px;">
          <h3>Недостаточно прав</h3>
          <p style="color:var(--muted);font-size:14px;line-height:1.7;">
            Ваша роль — <b style="color:var(--text)">${esc(NOVAAdmin.ROLE_LABELS[user.role] || user.role)}</b>.
            Этот раздел требует: <b style="color:var(--text)">${actions.map(a => ({ view: 'просмотр', review: 'рассмотрение заявок', export: 'экспорт' }[a] || a)).join(', ')}</b>.
            Обратитесь к администратору Альянса.
          </p>
        </div>`;
      return null;
    }
    mountShell(active, user);
    return user;
  }

  function toast(msg, kind = 'ok') {
    let host = document.getElementById('novaToast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'novaToast';
      host.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;align-items:center;';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.style.cssText = `
      background:var(--panel-2);border:1px solid ${kind === 'error' ? 'rgba(255,79,109,.4)' : 'rgba(87,230,161,.35)'};
      color:var(--text);border-radius:4px;padding:13px 20px;font-size:13.5px;box-shadow:0 12px 40px rgba(0,0,0,.5);
      animation:novaToastIn .25s ease;`;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2800);
    setTimeout(() => t.remove(), 3300);
  }

  function show(contentId, loadingId) {
    if (loadingId) document.getElementById(loadingId).style.display = 'none';
    if (contentId) document.getElementById(contentId).style.display = 'block';
  }

  return { guard, mountShell, toast, show, esc, fmtDate, fmtDateTime };
})();
