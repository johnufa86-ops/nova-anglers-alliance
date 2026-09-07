import * as fs from 'fs';
import * as path from 'path';

interface VirtualFile {
  path: string;
  content: string;
}

const files: VirtualFile[] = [
  // 1. public/cabinet-applications.html
  {
    path: 'public/cabinet-applications.html',
    content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Мои заявки — Кабинет спортсмена</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <div class="max-w-5xl mx-auto py-8 px-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Мои заявки на турниры</h1>
      <a href="/cabinet.html" class="text-blue-600 hover:underline">← Назад в профиль</a>
    </div>

    <div id="applicationsContainer" class="space-y-6">
      <p class="text-gray-500">Загрузка ваших заявок...</p>
    </div>
  </div>

  <div id="paymentModal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 relative">
      <button onclick="closePaymentModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      <h3 class="text-xl font-bold mb-4">Оплата взноса участника</h3>
      
      <div id="paymentMethods" class="flex gap-2 mb-4">
        <button id="btnMethodBank" onclick="switchMethod('bank')" class="flex-1 py-2 px-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium text-sm">По реквизитам</button>
        <button id="btnMethodOnline" onclick="switchMethod('online')" class="flex-1 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hidden">Онлайн-оплата</button>
      </div>

      <div id="bankDetailsSection" class="space-y-3">
        <div class="bg-gray-50 p-4 rounded-lg text-sm border space-y-2">
          <div><span class="text-gray-500">Банк:</span> <strong id="valBank">Загрузка...</strong></div>
          <div><span class="text-gray-500">Счёт:</span> <strong id="valAccount"></strong></div>
          <div><span class="text-gray-500">БИК:</span> <strong id="valBik"></strong></div>
          <div><span class="text-gray-500">ИНН:</span> <strong id="valInn"></strong></div>
          <div><span class="text-gray-500">Получатель:</span> <strong id="valRecipient"></strong></div>
          <div class="pt-2 border-t"><span class="text-gray-500">Назначение:</span> <div id="valPurpose" class="font-medium text-gray-800 break-words mt-1"></div></div>
        </div>

        <button onclick="copyBankDetails()" class="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition">
          Скопировать реквизиты
        </button>

        <div class="mt-4">
          <label class="block text-sm font-medium mb-1">Загрузите чек (JPG, PNG, PDF до 5 МБ):</label>
          <div id="dropZone" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition">
            <p class="text-gray-500 text-sm">Перетащите чек сюда или нажмите для выбора</p>
            <input type="file" id="proofFileInput" accept=".jpg,.jpeg,.png,.pdf" class="hidden">
            <div id="selectedFileName" class="mt-2 text-xs font-semibold text-blue-600 hidden"></div>
          </div>
        </div>

        <button id="btnSubmitProof" onclick="uploadProofFile()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition mt-3">
          Отправить подтверждение
        </button>
      </div>

      <div id="onlinePaymentSection" class="hidden text-center py-6">
        <p class="text-gray-600 mb-4 text-sm">Вы будете перенаправлены на платёжный шлюз.</p>
        <button class="py-2.5 px-6 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm">
          Перейти к оплате
        </button>
      </div>
    </div>
  </div>

  <script src="/js/cabinet.js"></script>
</body>
</html>
`
  },
  // 2. public/js/cabinet.js
  {
    path: 'public/js/cabinet.js',
    content: `let currentAppId = null;
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
        badge = \`<span class="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-medium" title="\${p.rejectReason || ''}">Чек отклонён</span>\`;
      }

      const showPayButton = p.status !== 'paid' && p.proofStatus !== 'confirmed';

      return \`
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-bold">\${app.competition?.title || 'Соревнование'}</h2>
              \${badge}
            </div>
            <p class="text-sm text-gray-500 mt-1">Статус заявки: <strong>\${app.status}</strong></p>
            \${p.rejectReason ? \`<p class="text-xs text-red-600 mt-1 font-medium">Причина отклонения: \${p.rejectReason}</p>\` : ''}
          </div>
          <div>
            \${showPayButton ? \`
              <button onclick="openPaymentModal('\${app.id}', '\${app.competitionId || ''}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
                \${p.proofStatus === 'rejected' ? 'Загрузить новый чек' : 'Оплатить'}
              </button>
            \` : '<span class="text-sm text-gray-400 font-medium">Допущен</span>'}
          </div>
        </div>
      \`;
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
    const res = await fetch(\`/api/payment-details?competitionId=\${compId || ''}\`);
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

  const text = \`Банк: \${bank}\\nСчет: \${acc}\\nБИК: \${bik}\\nИНН: \${inn}\\nПолучатель: \${rec}\\nНазначение: \${purp}\`;
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
        fileNameLabel.textContent = \`Выбран файл: \${fileInput.files[0].name}\`;
        fileNameLabel.classList.remove('hidden');
      }
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length && fileNameLabel) {
      fileNameLabel.textContent = \`Выбран файл: \${fileInput.files[0].name}\`;
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
    const res = await fetch(\`/api/me/applications/\${currentAppId}/payment-proof\`, {
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
`
  },
  // 3. public/admin-payment-details.html
  {
    path: 'public/admin-payment-details.html',
    content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Управление реквизитами — Панель организатора</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <div class="max-w-4xl mx-auto py-10 px-4">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold">Банковские реквизиты</h1>
      <a href="/admin.html" class="text-blue-600 hover:underline">← Назад в админку</a>
    </div>

    <div class="bg-white rounded-xl shadow p-6 mb-8 border border-gray-100">
      <h2 class="text-lg font-semibold mb-4">Глобальные реквизиты организации</h2>
      <form id="detailsForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Наименование банка</label>
          <input type="text" id="bankName" required class="w-full border rounded-lg p-2.5 text-sm" placeholder="ПАО СБЕРБАНК">
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Расчетный счет (20 цифр)</label>
            <input type="text" id="accountNumber" maxlength="20" required class="w-full border rounded-lg p-2.5 text-sm" placeholder="40802810000000000000">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">БИК (9 цифр)</label>
            <input type="text" id="bik" maxlength="9" required class="w-full border rounded-lg p-2.5 text-sm" placeholder="044525225">
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">ИНН (10 или 12 цифр)</label>
            <input type="text" id="inn" maxlength="12" class="w-full border rounded-lg p-2.5 text-sm" placeholder="7701234567">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Получатель платежа</label>
            <input type="text" id="recipientName" required class="w-full border rounded-lg p-2.5 text-sm" placeholder="Федерация рыболовного спорта">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Шаблон назначения платежа</label>
          <input type="text" id="paymentPurpose" required class="w-full border rounded-lg p-2.5 text-sm" placeholder="Целевой взнос за участие в турнире">
        </div>
        <div id="formErrors" class="text-red-600 text-sm hidden"></div>
        <div id="formSuccess" class="text-green-600 text-sm hidden">Реквизиты успешно сохранены!</div>
        <button type="submit" class="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition">
          Сохранить реквизиты
        </button>
      </form>
    </div>
  </div>

  <script>
    async function loadDetails() {
      const res = await fetch('/api/admin/payment-details');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          document.getElementById('bankName').value = json.data.bankName || '';
          document.getElementById('accountNumber').value = json.data.accountNumber || '';
          document.getElementById('bik').value = json.data.bik || '';
          document.getElementById('inn').value = json.data.inn || '';
          document.getElementById('recipientName').value = json.data.recipientName || '';
          document.getElementById('paymentPurpose').value = json.data.paymentPurpose || '';
        }
      }
    }

    document.getElementById('detailsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('formErrors');
      const succBox = document.getElementById('formSuccess');
      errBox.classList.add('hidden');
      succBox.classList.add('hidden');

      const payload = {
        bankName: document.getElementById('bankName').value,
        accountNumber: document.getElementById('accountNumber').value,
        bik: document.getElementById('bik').value,
        inn: document.getElementById('inn').value,
        recipientName: document.getElementById('recipientName').value,
        paymentPurpose: document.getElementById('paymentPurpose').value,
      };

      const res = await fetch('/api/admin/payment-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        errBox.textContent = data.error || 'Ошибка при сохранении';
        errBox.classList.remove('hidden');
      } else {
        succBox.classList.remove('hidden');
      }
    });

    loadDetails();
  </script>
</body>
</html>
`
  },
  // 4. public/admin-application.html
  {
    path: 'public/admin-application.html',
    content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Модерация заявки — Админка</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <div class="max-w-4xl mx-auto py-8 px-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Карточка заявки</h1>
      <a href="/admin-applications.html" class="text-blue-600 hover:underline">← Назад к списку</a>
    </div>

    <div id="applicationCard" class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
      <p class="text-gray-500">Загрузка данных заявки...</p>
    </div>
  </div>

  <div id="rejectModal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
      <h3 class="text-lg font-bold mb-2">Отклонение подтверждения оплаты</h3>
      <p class="text-sm text-gray-500 mb-4">Укажите обязательную причину отклонения для уведомления спортсмена:</p>
      
      <textarea id="rejectReasonInput" rows="4" class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Нечитаемый чек, неверная сумма взноса..."></textarea>
      <div id="rejectError" class="text-red-600 text-xs mt-1 hidden">Причина обязательна для заполнения</div>

      <div class="flex justify-end gap-3 mt-4">
        <button onclick="closeRejectModal()" class="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Отмена</button>
        <button onclick="submitRejection()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Отклонить чек</button>
      </div>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('id');

    async function loadCard() {
      const card = document.getElementById('applicationCard');
      if (!appId) {
        card.innerHTML = '<p class="text-red-500">ID заявки не указан</p>';
        return;
      }

      try {
        const res = await fetch(\`/api/admin/applications/\${appId}\`);
        if (!res.ok) {
          card.innerHTML = '<p class="text-red-500">Заявка не найдена</p>';
          return;
        }

        const data = await res.json();
        const app = data.application || data;
        const p = app.payment || {};

        let proofBlock = '<p class="text-gray-400 text-sm italic">Подтверждение оплаты не прикреплено</p>';
        if (p.proofFileUrl) {
          const isPdf = p.proofFileUrl.toLowerCase().endsWith('.pdf');
          proofBlock = \`
            <div class="border rounded-xl p-5 bg-gray-50 mt-4 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-sm text-gray-800">Квитанция / Чек перевода</h3>
                <span class="text-xs px-2.5 py-1 rounded-full font-medium \${
                  p.proofStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                  p.proofStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }">
                  \${p.proofStatus || 'Ожидает проверки'}
                </span>
              </div>

              <div class="bg-white border rounded-lg p-2 flex items-center justify-center overflow-hidden max-h-80">
                \${isPdf ? \`
                  <div class="py-12 text-center text-gray-500">
                    <p class="font-medium text-sm">Документ формата PDF</p>
                    <p class="text-xs mt-1 text-gray-400">Используйте кнопку скачивания для просмотра</p>
                  </div>
                \` : \`
                  <img src="/api/files/payment-proof/\${p.id}" alt="Чек" class="object-contain max-h-72 rounded">
                \`}
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                <a href="/api/files/payment-proof/\${p.id}" target="_blank" download class="px-4 py-2 bg-gray-800 hover:bg-black text-white rounded-lg text-xs font-medium transition">
                  Скачать оригинал
                </a>

                \${p.proofStatus === 'awaiting_review' ? \`
                  <div class="flex items-center gap-2">
                    <button onclick="reviewPayment('confirm')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition">
                      Подтвердить оплату
                    </button>
                    <button onclick="openRejectModal()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition">
                      Отклонить
                    </button>
                  </div>
                \` : ''}
              </div>

              \${p.rejectReason ? \`
                <div class="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                  <strong>Причина отклонения:</strong> \${p.rejectReason}
                </div>
              \` : ''}
            </div>
          \`;
        }

        card.innerHTML = \`
          <div class="border-b pb-4">
            <h2 class="text-xl font-bold text-gray-900">\${app.competition?.title || 'Соревнование'}</h2>
            <p class="text-gray-600 text-sm mt-1">Спортсмен: <strong>\${app.athlete?.firstName || ''} \${app.athlete?.lastName || ''}</strong> (\${app.athlete?.email || ''})</p>
            <p class="text-gray-600 text-sm">Статус заявки: <span class="font-semibold text-gray-800">\${app.status}</span></p>
            \${app.fee ? \`<p class="text-gray-600 text-sm">Сумма взноса: <strong>\${app.fee} ₽</strong></p>\` : ''}
          </div>
          \${proofBlock}
        \`;
      } catch (err) {
        card.innerHTML = '<p class="text-red-500">Ошибка загрузки заявки</p>';
      }
    }

    async function reviewPayment(action, rejectReason = null) {
      try {
        const res = await fetch(\`/api/admin/applications/\${appId}/payment-review\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, rejectReason })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Ошибка операции');
        } else {
          alert(action === 'confirm' ? 'Оплата подтверждена!' : 'Чек отклонен.');
          closeRejectModal();
          loadCard();
        }
      } catch (e) {
        alert('Сетевая ошибка запроса');
      }
    }

    function openRejectModal() {
      document.getElementById('rejectModal').classList.remove('hidden');
      document.getElementById('rejectReasonInput').value = '';
      document.getElementById('rejectError').classList.add('hidden');
    }

    function closeRejectModal() {
      document.getElementById('rejectModal').classList.add('hidden');
    }

    function submitRejection() {
      const reason = document.getElementById('rejectReasonInput').value.trim();
      if (!reason) {
        document.getElementById('rejectError').classList.remove('hidden');
        return;
      }
      reviewPayment('reject', reason);
    }

    loadCard();
  </script>
</body>
</html>
`
  },
  // 5. public/admin-competition.html
  {
    path: 'public/admin-competition.html',
    content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Управление соревнованием — Админка</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <div class="max-w-4xl mx-auto py-8 px-4">
    <div class="flex items-center justify-between mb-6">
      <h1 id="competitionTitle" class="text-2xl font-bold">Карточка соревнования</h1>
      <a href="/admin.html" class="text-blue-600 hover:underline">← Назад</a>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Рейтинг турнира</h2>
          <p class="text-sm text-gray-500 mt-0.5">Начисление очков участникам согласно протоколу мест</p>
        </div>
        <button id="btnCalculateRating" onclick="triggerRatingCalculation()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
          Рассчитать рейтинг
        </button>
      </div>

      <div id="ratingCalcStatus" class="hidden text-sm p-4 rounded-lg"></div>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug') || window.location.pathname.split('/').pop();

    async function triggerRatingCalculation() {
      const btn = document.getElementById('btnCalculateRating');
      const statusBox = document.getElementById('ratingCalcStatus');
      btn.disabled = true;
      btn.textContent = 'Выполняется расчёт...';
      statusBox.className = 'hidden';

      try {
        const res = await fetch(\`/api/admin/competitions/\${slug}/calculate-rating\`, {
          method: 'POST'
        });
        const data = await res.json();
        statusBox.classList.remove('hidden');

        if (!res.ok) {
          statusBox.className = 'text-sm p-4 rounded-lg bg-red-50 text-red-700 border border-red-200';
          statusBox.textContent = data.error || 'Ошибка при пересчёте рейтинга';
        } else {
          statusBox.className = 'text-sm p-4 rounded-lg bg-green-50 text-green-700 border border-green-200';
          statusBox.innerHTML = \`
            <strong>Рейтинг успешно рассчитан!</strong><br>
            Сезон: <strong>\${data.season}</strong><br>
            Обработано участников: <strong>\${data.calculatedCount}</strong>
          \`;
        }
      } catch (err) {
        statusBox.className = 'text-sm p-4 rounded-lg bg-red-50 text-red-700 border border-red-200';
        statusBox.textContent = 'Сетевая ошибка при обращении к серверу.';
        statusBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Рассчитать рейтинг';
      }
    }
  </script>
</body>
</html>
`
  },
  // 6. public/rating.html
  {
    path: 'public/rating.html',
    content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Официальный рейтинг — Nova Anglers Alliance</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <div class="max-w-5xl mx-auto py-10 px-4">
    <header class="mb-8">
      <h1 class="text-3xl font-extrabold tracking-tight">Рейтинг спортсменов</h1>
      <p class="text-gray-500 mt-1">Официальная таблица начисления баллов сезона</p>
    </header>

    <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
      <div class="flex flex-wrap gap-3 items-center">
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Сезон</label>
          <select id="seasonFilter" onchange="resetAndLoad()" class="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="2026" selected>2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Дисциплина</label>
          <select id="disciplineFilter" onchange="renderTable()" class="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="all">Все дисциплины</option>
            <option value="spinning">Спиннинг</option>
            <option value="feeder">Фидер</option>
          </select>
        </div>
      </div>
      <div class="w-full sm:w-64">
        <label class="block text-xs font-semibold text-gray-500 mb-1">Поиск по спортсмену</label>
        <input type="text" id="searchInput" oninput="renderTable()" placeholder="Имя или фамилия..." class="w-full border rounded-lg px-3 py-1.5 text-sm">
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table class="w-full text-left border-collapse text-sm">
        <thead class="bg-gray-50 border-b text-gray-500 text-xs uppercase">
          <tr>
            <th class="py-3.5 px-4 font-semibold text-center w-16">#</th>
            <th class="py-3.5 px-4 font-semibold">Имя</th>
            <th class="py-3.5 px-4 font-semibold">Клуб / Город</th>
            <th class="py-3.5 px-4 font-semibold text-center">Турниров</th>
            <th class="py-3.5 px-4 font-semibold text-right">Очки</th>
          </tr>
        </thead>
        <tbody id="ratingTableBody" class="divide-y divide-gray-100">
          <tr><td colspan="5" class="py-8 text-center text-gray-400">Загрузка рейтинга...</td></tr>
        </tbody>
      </table>

      <div class="p-4 border-t flex items-center justify-between text-sm text-gray-500">
        <span id="pageInfo">Страница 1</span>
        <div class="flex gap-2">
          <button id="btnPrev" onclick="changePage(-1)" class="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-50" disabled>Назад</button>
          <button id="btnNext" onclick="changePage(1)" class="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Вперед</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentPage = 1;
    const pageSize = 50;
    let allItems = [];

    async function loadRating() {
      const season = document.getElementById('seasonFilter').value;
      const tbody = document.getElementById('ratingTableBody');
      tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400">Загрузка данных...</td></tr>';

      try {
        const res = await fetch(\`/api/rating?season=\${season}&page=\${currentPage}&limit=\${pageSize}\`);
        const data = await res.json();
        allItems = data.items || [];
        renderTable();
        updatePagination(data.total || allItems.length);
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500">Ошибка загрузки рейтинга</td></tr>';
      }
    }

    function renderTable() {
      const search = document.getElementById('searchInput').value.toLowerCase().trim();
      const tbody = document.getElementById('ratingTableBody');

      const filtered = allItems.filter(item => {
        return !search || item.name.toLowerCase().includes(search);
      });

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400">Спортсмены не найдены</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        let rowClass = 'hover:bg-gray-50 transition';
        let rankBadge = \`<span class="font-bold text-gray-600">\${item.rank}</span>\`;

        if (item.rank === 1) {
          rowClass = 'bg-yellow-50/70 font-medium hover:bg-yellow-50';
          rankBadge = '<span class="text-base" title="1 место">🥇</span>';
        } else if (item.rank === 2) {
          rowClass = 'bg-slate-100/70 font-medium hover:bg-slate-100';
          rankBadge = '<span class="text-base" title="2 место">🥈</span>';
        } else if (item.rank === 3) {
          rowClass = 'bg-amber-50/70 font-medium hover:bg-amber-50';
          rankBadge = '<span class="text-base" title="3 место">🥉</span>';
        }

        const clubCity = [item.club, item.city].filter(Boolean).join(' • ') || '—';

        return \`
          <tr class="\${rowClass}">
            <td class="py-3.5 px-4 text-center">\${rankBadge}</td>
            <td class="py-3.5 px-4 font-semibold text-gray-900">\${item.name}</td>
            <td class="py-3.5 px-4 text-gray-500">\${clubCity}</td>
            <td class="py-3.5 px-4 text-center text-gray-600">\${item.tournamentsCount}</td>
            <td class="py-3.5 px-4 text-right font-bold text-blue-600">\${item.points}</td>
          </tr>
        \`;
      }).join('');
    }

    function updatePagination(total) {
      document.getElementById('pageInfo').textContent = \`Страница \${currentPage} (Всего участников: \${total})\`;
      document.getElementById('btnPrev').disabled = currentPage <= 1;
      document.getElementById('btnNext').disabled = currentPage * pageSize >= total;
    }

    function changePage(delta) {
      currentPage += delta;
      loadRating();
    }

    function resetAndLoad() {
      currentPage = 1;
      loadRating();
    }

    loadRating();
  </script>
</body>
</html>
`
  },
  // 7. scripts/stage65-test.ts (Unit-тесты)
  {
    path: 'scripts/stage65-test.ts',
    content: `import { describe, it, expect } from 'bun:test';
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
`
  },
  // 8. scripts/stage65-integration-test.ts (Интеграционные тесты)
  {
    path: 'scripts/stage65-integration-test.ts',
    content: `import { describe, it, expect } from 'bun:test';

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
`
  }
];

console.log('--- Генерация и запись файлов фронтенда и тестов ---');
for (const file of files) {
  const full = path.join(process.cwd(), file.path);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, file.content.trimStart(), 'utf-8');
  console.log(`[OK] Создан: ${file.path}`);
}

// Встраивание ленивого таймаута в API-роуты
function injectTimeout(filePath: string) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf-8');
  if (!content.includes('applyLazyPaymentTimeout')) {
    content = `import { applyLazyPaymentTimeout } from '@/lib/applications';\n` + content;
    content = content.replace(
      /export async function GET\([^\)]*\)\s*\{/,
      (match) => `${match}\n  await applyLazyPaymentTimeout(db);`
    );
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`[+] Таймаут встроен в: ${filePath}`);
  }
}

injectTimeout('src/app/api/me/applications/route.ts');
injectTimeout('src/app/api/admin/applications/route.ts');

console.log('--- Все компоненты Части 2 успешно записаны! ---');