/* ============================================================
   NOVA ANGLERS ALLIANCE — REGISTRATION WIZARD (STAGE 4)
   ============================================================
   Flow:  registration → competition → participant/team → application → status

   ЭТАП 4: заявка уходит на сервер (POST /api/applications) и
   сохраняется в центральной базе. Номер NOVA-YYYY-NNNNNN
   генерирует сервер и гарантирует уникальность.

   Экраны ошибок (§23 спека):
     • нет сети            → OFFLINE-баннер, данные формы не теряются
     • серверная ошибка    → «Временная ошибка»
     • регистрация закрыта → сервер проверяет на этапе подачи
     • повторная заявка    → сервер 409 + баннер с номером и статусом

   Подтверждение: register.html?id=…&app=NOVA-…&t=… — ссылка-капсула,
   работает на любом устройстве (токен выдаётся сервером при подаче).
   ============================================================ */

(function(){

  let compId = NOVA.qs('id') || 'nova-street-river-ufa-2026';
  const appId  = NOVA.qs('app');
  const appTok = NOVA.qs('t');

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  // Declared up front — revisit branch returns early and calls goToStep()
  // from an async callback, so this must be past its temporal dead zone.
  let currentStep = 1;
  let selectedType = null;

  const wizardRoot = $('#wizardRoot');
  const pageHero   = $('.page-hero');

  /* ----------------------------------------------------------
     banners
  ---------------------------------------------------------- */
  function showBanner(html){
    const box = $('#errorBanner');
    box.innerHTML = html;
    box.style.display = 'block';
    box.scrollIntoView({behavior:'smooth', block:'center'});
  }
  function hideBanner(){
    const box = $('#errorBanner');
    box.style.display = 'none';
    box.innerHTML = '';
  }

  function bannerHTML(kind, title, text){
    const cls = kind === 'error' ? 'reg-banner reg-banner-error'
              : kind === 'warn'  ? 'reg-banner reg-banner-warn'
              : 'reg-banner';
    return `<div class="${cls}"><span><b>${title}</b>${text ? ` ${text}` : ''}</span></div>`;
  }

  /* ----------------------------------------------------------
     STEP 0 — competition header (server-first, demo fallback)
  ---------------------------------------------------------- */
  let competition = null;      // текущие данные (сервер || демо)
  let serverOnline = true;     // удалось ли получить данные с сервера

  function paintCompetition(c){
    if(!c) return;
    $('#pageTitle').textContent = `Регистрация — ${c.shortTitle || c.title || 'соревнование'} — NOVA ANGLERS ALLIANCE`;
    $('#bcComp').textContent = c.shortTitle || c.title || '…';
    $('#bcComp').href = `competition.html?id=${c.id || compId}`;
    $('#sTitle').textContent = c.shortTitle || c.title || '—';
    if(c.dateLabel) $('#sDate').textContent = c.dateLabel;
    if(c.place) $('#sPlace').textContent = c.place;
    if(c.disciplineLabel) $('#sDiscipline').textContent = c.disciplineLabel;
    $('#backToCompClosed').href = `competition.html?id=${c.id || compId}`;
    $('#backToComp').href = `competition.html?id=${c.id || compId}`;
  }

  async function loadCompetition(){
    if(!compId || compId === 'nova-cup-volga'){
      compId = 'nova-street-river-ufa-2026';
    }
    try {
      const data = await NOVA_API.get(`/api/competitions/${encodeURIComponent(compId)}`);
      competition = data.competition;
      serverOnline = true;
    } catch(e){
      // Try to discover active competition from catalog API
      try {
        const cat = await NOVA_API.get('/api/competitions');
        if (cat && Array.isArray(cat.competitions) && cat.competitions.length > 0) {
          const active = cat.competitions.find(x => x.registration === 'open' || x.stage === 'upcoming') || cat.competitions[0];
          if (active) {
            compId = active.slug || active.id;
            const single = await NOVA_API.get(`/api/competitions/${encodeURIComponent(compId)}`);
            competition = single.competition;
            serverOnline = true;
            return true;
          }
        }
      } catch(catErr) {}

      // сервер недоступен — показываем форму по демо-данным
      competition = NOVA.competition(compId) || (window.NOVA_DATA && NOVA_DATA.competitions && NOVA_DATA.competitions[0]);
      serverOnline = false;
      if(!competition) { paintNotFound(); return false; }
    }
    return true;
  }

  function paintNotFound(){
    wizardRoot.style.display = 'none';
    pageHero.style.display = 'none';
    $('#notFound').style.display = 'block';
  }

  /* ============================================================
     REVISIT MODE — прямая/сохранённая ссылка ?app=NOVA-…&t=…
     ============================================================ */
  if(appId){
    (async () => {
      try {
        const app = await NOVAApplications.getById(appId, appTok || undefined);
        if(!app || !app.competition || app.competition.slug !== compId){
          wizardRoot.style.display = 'none';
          pageHero.style.display = 'none';
          $('#notFound').style.display = 'block';
          $('#notFound .empty-state').textContent = 'Заявка не найдена. Проверьте ссылку или номер заявки.';
          return;
        }
        paintCompetition({
          id: app.competition.slug, shortTitle: app.competition.shortTitle,
          dateLabel: app.competition.dateLabel, place: app.competition.place,
        });
        renderConfirmation(app);
        goToStep(4);
        markStepperDoneUpTo(4);
      } catch(e){
        wizardRoot.style.display = 'none';
        pageHero.style.display = 'none';
        $('#notFound').style.display = 'block';
        $('#notFound .empty-state').textContent = e.message || 'Заявка не найдена. Проверьте ссылку или номер заявки.';
      }
    })();
    return; // nothing else on this page needs to run in revisit mode
  }

  /* ============================================================
     NEW APPLICATION MODE
     ============================================================ */
  (async () => {

    const found = await loadCompetition();
    if(!found) return;

    if(competition.registration === 'closed' || competition.stage === 'finished'){
      wizardRoot.style.display = 'none';
      pageHero.style.display = 'none';
      $('#closedNotice').style.display = 'block';
      return;
    }

    paintCompetition(competition);

    if(!serverOnline){
      showBanner(bannerHTML('warn',
        'Нет связи с сервером.',
        'Форма показана в демонстрационном режиме — подать заявку, пока нет подключения, нельзя.'));
    }

    /* duplicate-application notice — из кеша этого устройства.
       Истинный контроль дубликатов делает сервер при подаче. */
    const existing = NOVAApplications.listByCompetition(compId);
    if(existing.length){
      const last = existing[existing.length - 1];
      $('#dupBanner').style.display = 'block';
      $('#dupBanner').innerHTML = `
        <div class="reg-banner">
          <span>У этого браузера уже есть заявка на этот турнир — <b>${last.number}</b> (${last.participantName || 'участник'}).
          Статус: <b>${NOVAApplications.statusLabel(last.status)}</b>.</span>
          <a href="register.html?id=${compId}&app=${last.number}&t=${last.token}" class="btn btn-ghost btn-sm">Посмотреть заявку</a>
        </div>`;
    }

    /* step 1 — participant type */
    const grid = $('#typeChoiceGrid');
    const athleteCard = grid.querySelector('[data-type="athlete"]');
    const teamCard = grid.querySelector('[data-type="team"]');
    const toStep2Btn = $('#toStep2');

    function selectType(type){
      if(!type) return;
      selectedType = type;
      athleteCard.classList.toggle('selected', type === 'athlete');
      teamCard.classList.toggle('selected', type === 'team');
      toStep2Btn.disabled = false;
    }

    function paintEntryType(){
      const hint = $('#entryTypeHint');
      athleteCard.style.display = '';
      teamCard.style.display = '';
      const entryType = competition.entryType || 'both';
      if(entryType === 'individual'){
        teamCard.style.display = 'none';
        hint.textContent = 'Формат этого турнира — личный зачёт. Доступна заявка спортсмена.';
        selectType('athlete');
      } else if(entryType === 'team'){
        athleteCard.style.display = 'none';
        hint.textContent = 'Формат этого турнира — экипажный зачёт. Доступна заявка экипажа.';
        selectType('team');
      } else {
        hint.textContent = 'Выберите, от чьего имени подаётся заявка.';
        selectType(selectedType);
      }
    }

    athleteCard.addEventListener('click', () => { if(athleteCard.style.display !== 'none') selectType('athlete'); });
    teamCard.addEventListener('click', () => { if(teamCard.style.display !== 'none') selectType('team'); });
    paintEntryType();

    toStep2Btn.addEventListener('click', () => {
      $('#formAthlete').style.display = selectedType === 'athlete' ? 'block' : 'none';
      $('#formTeam').style.display = selectedType === 'team' ? 'block' : 'none';
      goToStep(2);
    });

    /* ---------- step 2: dynamic team roster ---------- */
    const rosterRows = $('#rosterRows');
    let rosterCount = 0;

    function addRosterRow(label, removable){
      rosterCount++;
      const row = document.createElement('div');
      row.className = 'field';
      row.dataset.roster = rosterCount;
      row.innerHTML = `
        <label>${label}</label>
        <div style="display:flex;gap:10px;">
          <input type="text" style="flex:1;" data-roster-input>
          ${removable ? '<button type="button" class="btn btn-ghost btn-sm" data-remove-roster>✕</button>' : ''}
        </div>`;
      rosterRows.appendChild(row);
      if(removable){
        row.querySelector('[data-remove-roster]').addEventListener('click', () => {
          row.remove();
          relabelRoster();
        });
      }
      return row;
    }
    function relabelRoster(){
      const rows = $$('[data-roster]', rosterRows);
      rows.forEach((row, i) => {
        const label = i === 0 ? 'Капитан' : `Спортсмен ${i+1}`;
        row.querySelector('label').textContent = label;
      });
    }
    addRosterRow('Капитан', false);
    addRosterRow('Спортсмен 2', false);
    $('#addMember').addEventListener('click', () => {
      const n = $$('[data-roster]', rosterRows).length + 1;
      addRosterRow(`Спортсмен ${n}`, true);
    });

    /* ---------- validation helpers ---------- */
    function setError(input, message){
      const field = input.closest('.field');
      field.classList.add('has-error');
      let err = field.querySelector('.field-error');
      if(!err){ err = document.createElement('span'); err.className = 'field-error'; field.appendChild(err); }
      err.textContent = message;
    }
    function clearError(input){
      const field = input.closest('.field');
      field.classList.remove('has-error');
      const err = field.querySelector('.field-error');
      if(err) err.remove();
    }
    function required(input, message='Обязательное поле'){
      if(!input.value || !input.value.trim()){ setError(input, message); return false; }
      clearError(input); return true;
    }
    function validEmail(input){
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!input.value.trim()){ setError(input, 'Укажите e-mail'); return false; }
      if(!re.test(input.value.trim())){ setError(input, 'Проверьте формат e-mail'); return false; }
      clearError(input); return true;
    }
    function validPhone(input){
      const digits = input.value.replace(/\D/g, '');
      if(!digits){ setError(input, 'Укажите телефон'); return false; }
      if(digits.length < 10){ setError(input, 'Проверьте номер телефона'); return false; }
      clearError(input); return true;
    }
    function validBirthdate(input){
      if(!input.value){ setError(input, 'Укажите дату рождения'); return false; }
      const d = new Date(input.value);
      const now = new Date();
      if(isNaN(d.getTime()) || d > now){ setError(input, 'Проверьте дату рождения'); return false; }
      const age = (now - d) / (365.25*24*3600*1000);
      if(age > 100 || age < 10){ setError(input, 'Проверьте дату рождения'); return false; }
      clearError(input); return true;
    }
    function requiredCheckbox(input, message){
      const field = input.closest('.field');
      if(!input.checked){
        field.classList.add('has-error');
        let err = field.querySelector('.field-error');
        if(!err){ err = document.createElement('span'); err.className = 'field-error'; field.appendChild(err); }
        err.textContent = message;
        return false;
      }
      field.classList.remove('has-error');
      const err = field.querySelector('.field-error');
      if(err) err.remove();
      return true;
    }

    function validateAthleteForm(){
      const f = $('#formAthlete');
      let ok = true;
      ok = required($('#a_lastname', f)) && ok;
      ok = required($('#a_firstname', f)) && ok;
      ok = validBirthdate($('#a_birthdate', f)) && ok;
      ok = validPhone($('#a_phone', f)) && ok;
      ok = validEmail($('#a_email', f)) && ok;
      ok = required($('#a_region', f)) && ok;
      ok = required($('#a_city', f)) && ok;
      ok = requiredCheckbox($('#a_agree_rules', f), 'Необходимо согласие с регламентом') && ok;
      ok = requiredCheckbox($('#a_agree_pdn', f), 'Необходимо согласие на обработку персональных данных') && ok;
      return ok;
    }
    function validateTeamForm(){
      const f = $('#formTeam');
      let ok = true;
      ok = required($('#t_name', f)) && ok;
      $$('[data-roster-input]', f).forEach(inp => { ok = required(inp, 'Укажите ФИО спортсмена') && ok; });
      ok = required($('#t_region', f)) && ok;
      ok = required($('#t_city', f)) && ok;
      ok = validPhone($('#t_phone', f)) && ok;
      ok = validEmail($('#t_email', f)) && ok;
      ok = requiredCheckbox($('#t_agree_rules', f), 'Необходимо согласие с регламентом') && ok;
      ok = requiredCheckbox($('#t_agree_pdn', f), 'Необходимо согласие на обработку персональных данных') && ok;
      return ok;
    }

    $('#toStep1Back').addEventListener('click', () => goToStep(1));

    $('#toStep3').addEventListener('click', () => {
      const ok = selectedType === 'athlete' ? validateAthleteForm() : validateTeamForm();
      if(!ok){
        const firstError = $('.has-error');
        if(firstError) firstError.scrollIntoView({behavior:'smooth', block:'center'});
        return;
      }
      hideBanner();
      renderReview();
      goToStep(3);
    });

    /* ---------- step 3: review ---------- */
    function collectAthlete(){
      return {
        lastname: $('#a_lastname').value.trim(),
        firstname: $('#a_firstname').value.trim(),
        middlename: $('#a_middlename').value.trim(),
        birthdate: $('#a_birthdate').value,
        phone: $('#a_phone').value.trim(),
        email: $('#a_email').value.trim(),
        region: $('#a_region').value.trim(),
        city: $('#a_city').value.trim(),
        club: $('#a_club').value.trim(),
        qualification: $('#a_qualification').value,
      };
    }
    function collectTeam(){
      const roster = $$('[data-roster-input]').map(i => i.value.trim()).filter(Boolean);
      return {
        name: $('#t_name').value.trim(),
        roster,
        club: $('#t_club').value.trim(),
        region: $('#t_region').value.trim(),
        city: $('#t_city').value.trim(),
        phone: $('#t_phone').value.trim(),
        email: $('#t_email').value.trim(),
        notes: $('#t_notes').value.trim(),
      };
    }

    function renderReview(){
      const box = $('#reviewContent');
      if(selectedType === 'athlete'){
        const a = collectAthlete();
        box.innerHTML = `
          <div class="review-block">
            <h4>Соревнование</h4>
            <div class="review-grid">
              <div><span>Турнир</span><b>${competition.shortTitle}</b></div>
              <div><span>Дата</span><b>${competition.dateLabel}</b></div>
            </div>
          </div>
          <div class="review-block">
            <h4>Спортсмен</h4>
            <div class="review-grid">
              <div><span>ФИО</span><b>${[a.lastname,a.firstname,a.middlename].filter(Boolean).join(' ')}</b></div>
              <div><span>Дата рождения</span><b>${formatDate(a.birthdate)}</b></div>
              <div><span>Телефон</span><b>${a.phone}</b></div>
              <div><span>E-mail</span><b>${a.email}</b></div>
              <div><span>Регион / город</span><b>${a.region}, ${a.city}</b></div>
              <div><span>Клуб</span><b>${a.club || '—'}</b></div>
              <div><span>Квалификация</span><b>${a.qualification}</b></div>
            </div>
          </div>
          <div class="review-agree"><span class="ok">✓</span>Согласие с регламентом и на обработку персональных данных получено.</div>`;
      } else {
        const t = collectTeam();
        box.innerHTML = `
          <div class="review-block">
            <h4>Соревнование</h4>
            <div class="review-grid">
              <div><span>Турнир</span><b>${competition.shortTitle}</b></div>
              <div><span>Дата</span><b>${competition.dateLabel}</b></div>
            </div>
          </div>
          <div class="review-block">
            <h4>Экипаж «${t.name}»</h4>
            <div class="review-grid">
              <div><span>Состав</span><b>${t.roster.join(', ')}</b></div>
              <div><span>Клуб</span><b>${t.club || '—'}</b></div>
              <div><span>Регион / город</span><b>${t.region}, ${t.city}</b></div>
              <div><span>Телефон</span><b>${t.phone}</b></div>
              <div><span>E-mail</span><b>${t.email}</b></div>
              ${t.notes ? `<div><span>Доп. сведения</span><b>${t.notes}</b></div>` : ''}
            </div>
          </div>
          <div class="review-agree"><span class="ok">✓</span>Согласие с регламентом и на обработку персональных данных получено.</div>`;
      }
    }

    $('#toStep2Back').addEventListener('click', () => goToStep(2));

    /* ---------- SUBMIT — на сервер, в центральную базу ---------- */
    /* карта полей сервера → инпуты формы (для inline-ошибок) */
    const FIELD_INPUTS = {
      athlete: {
        lastname: '#a_lastname', firstname: '#a_firstname', middlename: '#a_middlename',
        birthdate: '#a_birthdate', phone: '#a_phone', email: '#a_email',
        region: '#a_region', city: '#a_city', club: '#a_club', qualification: '#a_qualification',
      },
      team: {
        name: '#t_name', roster: '#rosterRows', club: '#t_club', region: '#t_region',
        city: '#t_city', phone: '#t_phone', email: '#t_email', notes: '#t_notes',
      },
    };

    function paintServerFieldErrors(details){
      if(!details || typeof details !== 'object') return;
      const map = FIELD_INPUTS[selectedType] || {};
      Object.entries(details).forEach(([field, msg]) => {
        const sel = map[field];
        if(!sel) return;
        const el = $(sel);
        if(!el) return;
        setError(el, typeof msg === 'string' ? msg : 'Проверьте поле');
      });
    }

    $('#submitApp').addEventListener('click', async () => {
      const btn = $('#submitApp');
      btn.disabled = true; btn.textContent = 'Отправка…';
      hideBanner();
      const participant = selectedType === 'athlete' ? collectAthlete() : collectTeam();
      try {
        const app = await NOVAApplications.create({
          competitionId: competition.id,
          participantType: selectedType,
          entryType: selectedType,
          participant,
        });
        // Перезагрузка в режим «revisit» — один код рендерит шаг 4 и сразу
        // после подачи, и при открытии сохранённой ссылки позже/с телефона.
        window.location.href = `register.html?id=${competition.id}&app=${app.applicationNumber}&t=${app.accessToken}`;
      } catch(e){
        btn.disabled = false; btn.textContent = 'Подать заявку';
        if(e && e.code === 'VALIDATION_ERROR'){
          paintServerFieldErrors(e.details);
          showBanner(bannerHTML('error', 'Проверьте правильность заполнения формы.', 'Введённые данные сохранены — исправьте отмеченные поля.'));
          const firstError = $('.has-error');
          if(firstError) firstError.scrollIntoView({behavior:'smooth', block:'center'});
        } else if(e && e.code === 'DUPLICATE_APPLICATION'){
          const d = e.details || {};
          $('#dupBanner').style.display = 'block';
          $('#dupBanner').innerHTML = `
            <div class="reg-banner">
              <span><b>У ВАС УЖЕ ЕСТЬ ЗАЯВКА НА ЭТО СОРЕВНОВАНИЕ</b> — ${d.applicationNumber || ''} (${NOVAApplications.statusLabel(d.status) || 'на рассмотрении'}).</span>
              <a href="competition.html?id=${competition.id}" class="btn btn-ghost btn-sm">К странице турнира</a>
            </div>`;
          goToStep(1);
          $('#dupBanner').scrollIntoView({behavior:'smooth', block:'center'});
        } else if(e && e.code === 'REGISTRATION_CLOSED'){
          wizardRoot.style.display = 'none';
          $('#closedNotice').style.display = 'block';
          window.scrollTo({top:0});
        } else if(e && e.code === 'OFFLINE'){
          showBanner(bannerHTML('error', 'НЕ УДАЛОСЬ ОТПРАВИТЬ ЗАЯВКУ.', 'Проверьте подключение к интернету и повторите попытку. Введённые данные не потеряны.'));
        } else {
          showBanner(bannerHTML('error', 'ВРЕМЕННАЯ ОШИБКА.', (e && e.message) || 'Попробуйте позже. Введённые данные не потеряны.'));
        }
      }
    });

    goToStep(1);
  })();

  /* ---------- stepper UI ---------- */
  function goToStep(n){
    currentStep = n;
    $$('.wizard-step').forEach(el => el.classList.remove('active'));
    $(`#wstep${n}`).classList.add('active');
    $$('.reg-step').forEach(el => {
      const s = +el.dataset.step;
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });
    $$('.reg-connector').forEach((el, i) => el.classList.toggle('done', i < n - 1));
    window.scrollTo({top: 0, behavior:'smooth'});
  }
  function markStepperDoneUpTo(n){
    $$('.reg-step').forEach(el => {
      const s = +el.dataset.step;
      el.classList.toggle('done', s < n);
      el.classList.toggle('active', s === n);
    });
    $$('.reg-connector').forEach((el, i) => el.classList.toggle('done', i < n - 1));
  }

  /* ---------- shared: confirmation rendering + download ---------- */
  function statusLabel(s){
    return NOVAApplications.statusLabel(s);
  }
  function formatDate(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    if(isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  function participantDisplayName(app){
    if(app.participantName) return app.participantName;
    if(app.entryType === 'team') return app.participant?.name || 'Экипаж';
    const p = app.participant || {};
    return [p.lastname, p.firstname, p.middlename].filter(Boolean).join(' ');
  }

  function renderConfirmation(app){
    const comp = app.competition || {};
    $('#cAppId').textContent = app.applicationNumber;
    const statusPill = $('#cStatus');
    statusPill.textContent = statusLabel(app.status);
    statusPill.className = 'status-pill ' + (app.status === 'approved' ? 'confirmed' : 'pending');
    $('#cComp').textContent = comp.shortTitle || comp.title || app.competitionId || '—';
    $('#cParticipant').textContent = participantDisplayName(app);
    $('#cDate').textContent = formatDate(app.submittedAt);
    $('#backToComp').href = `competition.html?id=${comp.slug || compId}`;

    $('#downloadApp').onclick = () => {
      const p = app.participant || {};
      const isTeam = app.entryType === 'team' || Array.isArray(p.roster);
      const lines = [
        'NOVA ANGLERS ALLIANCE — ЗАЯВКА НА УЧАСТИЕ',
        '='.repeat(44),
        `Номер заявки: ${app.applicationNumber}`,
        `Статус: ${statusLabel(app.status)}`,
        `Дата подачи: ${formatDate(app.submittedAt)}`,
        '',
        `Соревнование: ${comp.title || comp.shortTitle || '—'}`,
        comp.dateLabel ? `Дата турнира: ${comp.dateLabel}` : '',
        comp.place ? `Место: ${comp.place}` : '',
        '',
        isTeam ? 'ЭКИПАЖ' : 'СПОРТСМЕН',
        '-'.repeat(44),
      ];
      if(isTeam){
        lines.push(`Название: ${p.name || '—'}`, `Состав: ${(p.roster||[]).join(', ')}`,
          `Клуб: ${p.club||'—'}`, `Регион/город: ${p.region||'—'}${p.city ? ', ' + p.city : ''}`,
          `Телефон: ${p.phone||'—'}`, `E-mail: ${p.email||'—'}`);
        if(p.notes) lines.push(`Доп. сведения: ${p.notes}`);
      } else {
        lines.push(`ФИО: ${[p.lastname,p.firstname,p.middlename].filter(Boolean).join(' ') || '—'}`,
          `Дата рождения: ${formatDate(p.birthdate)}`, `Телефон: ${p.phone||'—'}`, `E-mail: ${p.email||'—'}`,
          `Регион/город: ${p.region||'—'}${p.city ? ', ' + p.city : ''}`, `Клуб: ${p.club||'—'}`,
          `Квалификация: ${p.qualification||'—'}`);
      }
      const blob = new Blob([lines.filter(l=>l!==undefined).join('\n')], {type:'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${app.applicationNumber}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    };
  }

})();
