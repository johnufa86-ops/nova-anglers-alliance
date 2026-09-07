import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * STAGE 6 §2 (dev) — GET /api/payments/mock/checkout?paymentId=...
 *
 * ЛОКАЛЬНАЯ тестовая страница оплаты для PAYMENTS_DRIVER=mock.
 * Эмулирует страницу провайдера: «Оплатить» генерирует СЕРВЕРНО
 * подписанное событие и проводит его через тот же webhook-обработчик,
 * что и настоящий провайдер. В проде mock запрещён (fail-fast).
 */

export async function GET(req: Request) {
  const { PAYMENTS_DRIVER } = await import('@/lib/payments');
  if (PAYMENTS_DRIVER !== 'mock') {
    return new NextResponse('Not Found', { status: 404 });
  }

  const url = new URL(req.url);
  const paymentId = String(url.searchParams.get('paymentId') || '');

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, amount: true, currency: true },
  });
  if (!payment) return new NextResponse('Payment not found', { status: 404 });

  const paid = payment.status === 'paid';
  const amount = (payment.amount / 100).toLocaleString('ru-RU', { style: 'currency', currency: payment.currency, maximumFractionDigits: 0 });

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock-оплата — NOVA</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#050d1f;color:#e8eefc;font-family:Manrope,Arial,sans-serif}
.card{background:#101f3f;border:1px solid rgba(143,163,200,.22);border-radius:16px;
padding:36px 40px;max-width:420px;text-align:center}
h1{margin:0 0 6px;font-size:20px;letter-spacing:.18em}
.gold{color:#f0b429}.amount{font-size:30px;font-weight:800;margin:14px 0 4px}
.mono{font-family:'JetBrains Mono',monospace;font-size:12px;color:#8fa3c8}
button{margin-top:22px;background:#2ecc71;border:0;border-radius:10px;color:#0a1630;
font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:14px 34px;
font-size:14px;cursor:pointer}
button.fail{background:#ff5d5d;margin-left:10px}
.badge{display:inline-block;margin-top:16px;padding:6px 14px;border-radius:99px;
background:rgba(46,204,113,.15);color:#2ecc71;font-weight:700;font-size:13px}
</style></head><body><div class="card">
<h1><span class="gold">NOVA</span> · MOCK-ОПЛАТА</h1>
<p class="mono">Тестовая страница провайдера (PAYMENTS_DRIVER=mock)</p>
<div class="amount">${amount}</div>
<p class="mono">paymentId: ${payment.id}<br>статус: ${payment.status}</p>
${paid
    ? `<span class="badge">Платёж уже оплачен</span><div style="margin-top:20px"><a href="/cabinet/applications.html" style="color:#4da3ff">Вернуться в кабинет</a></div>`
    : `<div><button onclick="pay('succeeded')">Оплатить (тест)</button><button class="fail" onclick="pay('failed')">Отклонить</button></div>
<div id="msg" style="margin-top:16px;color:#8fa3c8;font-size:13px"></div>`}
</div>
<script>
async function pay(outcome){
  document.getElementById('msg').textContent = 'Обработка...';
  const r = await fetch('/api/payments/mock/complete', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ paymentId: '${payment.id}', outcome })
  });
  const j = await r.json().catch(()=>({}));
  if (r.ok && j.ok) { location.href = '/cabinet/applications.html?paid=' + (outcome==='succeeded'?'1':'0'); }
  else { document.getElementById('msg').textContent = 'Ошибка: ' + (j?.error?.code || r.status); }
}
</script></body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
