let currentAppId = null;
let currentCompetitionId = null;
let paymentConfig = null;
let activeMethod = 'bank';

async function loadApplications() {
  const container = document.getElementById('applicationsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/me/applications');
    const json = await res.json();
    const apps = json.applications || json.data || [];

    if (!apps.length) {
      container.innerHTML = '<p class="text-gray-500">У вас пока нет активных заявок.</p>';
      return;
    }

    container.innerHTML = apps.map(app => {
      const p = app.payment || {};
      let badge = '<span class="text-xs bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full font-medium">Не оплачено</span>';
      
      if (p.proofStatus === 'awaiting_review') {
        badge = '<span class="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-medium">Чек на проверке</span>';
      } else if (p.proofStatus === 'confirmed' || p.status === 'paid') {
        badge = '<span class="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-medium">Оплачено</span>';
      } else if (p.proofStatus === 'rejected') {
        badge = `<span class="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-medium" title="${p.rejectReason || ''}">Чек отклонён</span>`;
      }

      const showPayButton = p.status !== 'paid' && p.proofStatus !== 'confirmed';

      return `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-bold">${app.competition?.title || 'Соревнование'}</h2>
              ${badge}
            </div>
            <p class="text-sm text-gray-500 mt-1">Статус заявки: <strong>${app.status}</strong></p>
            ${p.rejectReason ? `<p class="text-xs text-red-600 mt-1 font-medium">Причина отклонения: ${p.rejectReason}</p>` : ''}
          </div>
          <div>
            ${showPayButton ? `
              <button onclick="openPaymentModal('${app.id}', '${app.competitionId || ''}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
                ${p.proofStatus === 'rejected' ? 'Загрузить новый чек' : 'Оплатить'}
              </button>
            ` : '<span class="text-sm text-gray-400 font-medium">Допущен</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-red-500">Ошибка при загрузке заявок.</p>';
  }
}

async function openPaymentModal(appId, compId) {
  currentAppId = appId;
  currentCompetitionId = compId;
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/payment-details?competitionId=${compId || ''}`);
    const data = await res.json();
    paymentConfig = data.config || {};
    const d = data.details || {};

    const btnOnline = document.getElementById('btnMethodOnline');
    if (btnOnline) {
      if (paymentConfig.isOnlineEnabled) {
        btnOnline.classList.remove('hidden');
      } else {
        btnOnline.classList.add('hidden');
      }
    }

    document.getElementById('valBank').textContent = d.bankName || 'Не указан';
    document.getElementById('valAccount').textContent = d.accountNumber || '—';
    document.getElementById('valBik').textContent = d.bik || '—';
    document.getElementById('valInn').textContent = d.inn || '—';
    document.getElementById('valRecipient').textContent = d.recipientName || '—';
    document.getElementById('valPurpose').textContent = d.paymentPurpose || 'Целевой взнос за участие';

    switchMethod('bank');
  } catch (e) {
    alert('Не удалось загрузить реквизиты');
  }
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.add('hidden');
  currentAppId = null;
  currentCompetitionId = null;

  const fileInput = document.getElementById('proofFileInput');
  if (fileInput) fileInput.value = '';
  const label = document.getElementById('selectedFileName');
  if (label) {
    label.textContent = '';
    label.classList.add('hidden');
  }
}

function switchMethod(method) {
  activeMethod = method;
  const bankSec = document.getElementById('bankDetailsSection');
  const onlineSec = document.getElementById('onlinePaymentSection');
  const btnBank = document.getElementById('btnMethodBank');
  const btnOnline = document.getElementById('btnMethodOnline');

  if (method === 'bank') {
    if (bankSec) bankSec.classList.remove('hidden');
    if (onlineSec) onlineSec.classList.add('hidden');
    if (btnBank) btnBank.className = 'flex-1 py-2 px-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium text-sm';
    if (btnOnline) btnOnline.className = 'flex-1 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm';
  } else {
    if (bankSec) bankSec.classList.add('hidden');
    if (onlineSec) onlineSec.classList.remove('hidden');
    if (btnOnline) btnOnline.className = 'flex-1 py-2 px-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium text-sm';
    if (btnBank) btnBank.className = 'flex-1 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm';
  }
}

function copyBankDetails() {
  const bank = document.getElementById('valBank')?.textContent || '';
  const acc = document.getElementById('valAccount')?.textContent || '';
  const bik = document.getElementById('valBik')?.textContent || '';
  const inn = document.getElementById('valInn')?.textContent || '';
  const rec = document.getElementById('valRecipient')?.textContent || '';
  const purp = document.getElementById('valPurpose')?.textContent || '';

  const text = `Банк: ${bank}\nСчет: ${acc}\nБИК: ${bik}\nИНН: ${inn}\nПолучатель: ${rec}\nНазначение: ${purp}`;
  navigator.clipboard.writeText(text).then(() => alert('Реквизиты скопированы!'));
}

function initDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('proofFileInput');
  const fileNameLabel = document.getElementById('selectedFileName');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500');
    if (e.dataTransfer && e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      if (fileNameLabel) {
        fileNameLabel.textContent = `Выбран файл: ${fileInput.files[0].name}`;
        fileNameLabel.classList.remove('hidden');
      }
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length && fileNameLabel) {
      fileNameLabel.textContent = `Выбран файл: ${fileInput.files[0].name}`;
      fileNameLabel.classList.remove('hidden');
    }
  });
}

async function uploadProofFile() {
  const fileInput = document.getElementById('proofFileInput');
  if (!fileInput || !fileInput.files.length) {
    alert('Пожалуйста, выберите файл чека');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  const btn = document.getElementById('btnSubmitProof');
  if (btn) { btn.disabled = true; btn.textContent = 'Отправка...'; }

  try {
    const res = await fetch(`/api/me/applications/${currentAppId}/payment-proof`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Ошибка загрузки');
    } else {
      alert('Чек успешно отправлен на проверку!');
      closePaymentModal();
      loadApplications();
    }
  } catch (err) {
    alert('Сетевая ошибка при загрузке');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Отправить подтверждение'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadApplications();
  initDragAndDrop();
});
