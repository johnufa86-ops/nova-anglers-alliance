/* ============================================================
   NOVA ANGLERS ALLIANCE — ATHLETE CABINET UI SHELL
   ============================================================
   Каркас кабинета спортсмена: шапка, навигация, футер, guard,
   тосты, форматтеры. Данные — через NOVACabinet.
   ============================================================ */

window.NOVACabinetUI = (function () {

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
  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  }

  function headerHTML(active, user) {
    const links = [
      ['/cabinet', 'Обзор', 'dashboard'],
      ['/cabinet/applications', 'Мои заявки', 'applications'],
      ['/cabinet/documents', 'Документы', 'documents'],
      ['/cabinet/results', 'Результаты', 'results'],
      ['/cabinet/profile', 'Профиль', 'profile'],
    ];
    return `
      <div class="wrap">
        <a href="/cabinet" class="logo" style="font-family:'Space Grotesk',sans-serif;font-weight:700;letter-spacing:.02em;display:flex;align-items:center;gap:10px;">
          <img src="/assets/icon-star.png" alt="NOVA" style="width:26px;height:26px;">NOVA <span style="color:var(--muted);font-weight:500;">· КАБИНЕТ СПОРТСМЕНА</span>
        </a>
        <nav class="admin-nav">
          ${links.map(([href, label, key]) => `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="admin-user">
          <span class="cab-avatar" aria-hidden="true">${esc(initials(user.name))}</span>
          <span><b>${esc(user.name)}</b> · ${esc(NOVACabinet.ROLE_LABELS[user.role] || user.role)}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="cabLogout">Выйти</button>
        </div>
      </div>`;
  }

  function footerHTML() {
    return `
      <div class="wrap" style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <span>© 2026 NOVA Anglers Alliance · Кабинет спортсмена</span>
        <span><a href="/" style="color:var(--pulse-2);">← Вернуться на сайт</a></span>
      </div>`;
  }

  function mountShell(active, user) {
    const h = document.getElementById('adminHeader');
    const f = document.getElementById('adminFooter');
    if (h) h.innerHTML = headerHTML(active, user);
    if (f) f.innerHTML = footerHTML();
    const out = document.getElementById('cabLogout');
    if (out) out.addEventListener('click', async () => {
      await NOVACabinet.logout();
      window.location.href = '/cabinet';
    });
  }

  /**
   * Guard защищённых страниц кабинета.
   *   - не авторизован → форма входа/регистрации на /cabinet
   *   - staff-роль (admin/organizer/viewer) → карточка-подсказка со ссылкой
   *     в кабинет организатора (кабинет спортсмена — для athlete)
   * @returns user | null
   */
  async function guard(active) {
    const user = await NOVACabinet.me();
    if (!user) { window.location.href = '/cabinet'; return null; }
    const shell = document.getElementById('adminShell');
    if (shell) shell.style.display = 'flex';
    mountShell(active, user);
    if (user.role !== 'athlete') {
      document.getElementById('adminContent').innerHTML = `
        <div class="admin-card" style="max-width:560px;">
          <h3>Это кабинет спортсмена</h3>
          <p style="color:var(--muted);font-size:14px;line-height:1.7;">
            Вы вошли как <b style="color:var(--text)">${esc(NOVACabinet.ROLE_LABELS[user.role] || user.role)}</b>.
            Управление заявками и соревнованиями — в кабинете организатора.
          </p>
          <a href="/admin" class="btn btn-primary btn-sm" style="margin-top:18px;">Перейти в кабинет организатора</a>
        </div>`;
      return null;
    }
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

  /** Статус-плашка заявки (общая с админом терминология). */
  function pill(status, label) {
    return `<span class="pill ${status}">${esc(label || NOVAApplications.statusLabel(status))}</span>`;
  }

  /** Статус-плашка документа. */
  function docPill(status, label) {
    return `<span class="pill ${NOVACabinet.DOC_STATUS_CLASS[status] || 'open'}">${esc(label || status)}</span>`;
  }

  return { guard, mountShell, toast, esc, fmtDate, fmtDateTime, fmtSize, initials, pill, docPill };
})();
