/* mark JS as active — gates the .reveal animation in style.css so content
   is never stuck invisible if this script fails to run at all */
document.documentElement.classList.add('js');

/* ---------- header scroll state ---------- */
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', ()=>{ header.classList.toggle('scrolled', window.scrollY>40); }, {passive:true});

/* ---------- mobile nav ---------- */
const burger = document.getElementById('burgerBtn');
const nav = document.getElementById('primaryNav');
burger.addEventListener('click', ()=>{ burger.classList.toggle('open'); nav.classList.toggle('open'); });
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>{ burger.classList.remove('open'); nav.classList.remove('open'); }));

/* ---------- scroll reveal (with safety fallback for older browsers) ---------- */
const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
if('IntersectionObserver' in window){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.15});
  revealEls.forEach(el=>io.observe(el));
}else{
  revealEls.forEach(el=>el.classList.add('in'));
}

/* ---------- count-up stats (with safety fallback) ---------- */
const counters = document.querySelectorAll('[data-count]');
function runCounter(el){
  const target = +el.dataset.count; let cur=0;
  const step = Math.max(1, Math.ceil(target/40));
  const t = setInterval(()=>{ cur+=step; if(cur>=target){cur=target; clearInterval(t);} el.textContent=cur; },30);
}
if('IntersectionObserver' in window){
  const cio = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ runCounter(e.target); cio.unobserve(e.target); } });
  },{threshold:.5});
  counters.forEach(c=>cio.observe(c));
}else{
  counters.forEach(runCounter);
}

/* ---------- orbit ring builder (rating badges, progress rings) ---------- */
function orbitSVG(size, pct){
  const r = size/2 - 3;
  const c = 2*Math.PI*r;
  const offset = c - (Math.max(0,Math.min(100,pct))/100)*c;
  return `<svg viewBox="0 0 ${size} ${size}">
    <circle class="ring-bg" cx="${size/2}" cy="${size/2}" r="${r}"></circle>
    <circle class="ring-fg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
  </svg>`;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- shared render helpers for data-driven pages ---------- */

/** Competition card — used by index.html (preview) and competitions.html (full grid). */
function competitionCardHTML(c){
  const reg = NOVA.registrationLabel(c.registration);
  const regClass = c.registration === 'open' ? 'open' : (c.registration === 'soon' ? 'soon' : 'closed');
  const d = new Date(c.dateStart);
  const day = isNaN(d) ? '' : String(d.getDate()).padStart(2,'0');
  const monShort = isNaN(d) ? '' : d.toLocaleDateString('ru-RU',{month:'short'}).toUpperCase().replace('.','');
  const hasLimit = Boolean(c.participantsLimit && c.participantsLimit > 0 && !c.noLimit);
  const partTag = hasLimit
    ? `${c.participants}/${c.participantsLimit} уч.`
    : (c.participants > 0 ? `${c.participants} уч.` : 'Свободный приём');
  return `
    <a href="competition.html?id=${c.id}" class="cal-card" style="text-decoration:none;color:inherit;">
      <div class="cal-image">
        <span class="stage-badge ${c.stage}">${c.stage==='live'?'<span class="dot"></span>':''}${NOVA.stageLabel(c.stage)}</span>
        <span class="disc-tag">${NOVA.disciplineLabel(c.discipline)}</span>
      </div>
      <div class="cal-date"><b>${day}</b><span>${monShort}</span></div>
      <h4>${c.shortTitle}</h4>
      <div class="cal-tags"><span class="cal-tag">${c.disciplineLabel}</span><span class="cal-tag">${partTag}</span></div>
      <div class="cal-place">${c.place}</div>
      <div class="cal-status ${regClass}">${reg}</div>
    </a>`;
}

function emptyState(text){
  return `<div class="empty-state">${text}</div>`;
}

/* ---------- sync global footer, brand & socials from DB settings ---------- */
(async function syncGlobalSettings() {
  try {
    const res = await fetch('/api/settings/contacts');
    if (!res.ok) return;
    const data = await res.json();
    const s = data?.settings;
    if (!s) return;

    if (s.brandDesc) {
      const descEl = document.querySelector('.foot-brand p');
      if (descEl) descEl.textContent = s.brandDesc;
    }
    if (s.copyright) {
      const copyEl = document.querySelector('.foot-bottom p');
      if (copyEl) copyEl.textContent = s.copyright;
    }
    if (s.emailGeneral) {
      const emailLinks = document.querySelectorAll('a[href^="mailto:info@"]');
      emailLinks.forEach(el => {
        el.href = 'mailto:' + s.emailGeneral;
        el.textContent = s.emailGeneral;
      });
    }
    if (s.telegramUrl) {
      const tg = document.querySelector('.foot-social a[aria-label="Telegram"]');
      if (tg) { tg.href = s.telegramUrl; tg.target = '_blank'; tg.rel = 'noopener'; }
    }
    if (s.vkUrl) {
      const vk = document.querySelector('.foot-social a[aria-label="VK"]');
      if (vk) { vk.href = s.vkUrl; vk.target = '_blank'; vk.rel = 'noopener'; }
    }
  } catch (e) {
    // Non-blocking fallback
  }
})();
