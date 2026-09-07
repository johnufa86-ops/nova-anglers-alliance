// Брендирование
export const BRAND = {
  name: 'Nova Anglers Alliance',
  logoUrl: '/logo.png',
  primaryColor: '#2563eb',
  supportEmail: 'support@nova-anglers.ru',
  baseUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

// Цвета статусов
export const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  paid: '#10b981',
  awaiting_review: '#3b82f6',
  confirmed: '#10b981',
  submitted: '#3b82f6',
  under_review: '#3b82f6',
  needs_changes: '#f59e0b',
  withdrawn: '#6b7280',
};

function wrapHtml(title: string, body: string, unsubscribeToken?: string) {
  const unsubLink = unsubscribeToken
    ? `<p style="font-size:12px;color:#9ca3af;margin-top:24px;"><a href="${BRAND.baseUrl}/api/unsubscribe?token=${unsubscribeToken}">Отписаться от уведомлений</a></p>`
    : '';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#fff; padding:24px; border-radius:8px;">
      <h2 style="color:${BRAND.primaryColor};margin:0 0 16px 0;">${title}</h2>
      ${body}
      ${unsubLink}
      <p style="margin-top:24px;color:#6b7280;font-size:14px;">С уважением,<br/>Команда ${BRAND.name}<br/>
      <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a></p>
    </div>
  `;
}

export function layout(content: string, opts?: { unsubscribeToken?: string; title?: string }) {
  return wrapHtml(opts?.title || BRAND.name, content, opts?.unsubscribeToken);
}

// Универсальный verificationEmail — поддерживает обе сигнатуры:
// 1) verificationEmail({name, token, baseUrl})
// 2) verificationEmail(name, url, unsubscribeToken)
export function verificationEmail(
  arg1: { name: string; token: string; baseUrl: string } | string,
  arg2?: string,
  arg3?: string
) {
  if (typeof arg1 === 'string') {
    const name = arg1;
    const url = arg2 || '';
    const unsub = arg3;
    const body = `
      <p>Здравствуйте, ${name}!</p>
      <p>Спасибо за регистрацию в ${BRAND.name}.</p>
      <p>Для подтверждения email перейдите по ссылке:</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:${BRAND.primaryColor};color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Подтвердить email</a>
      <p style="color:#6b7280;font-size:14px;">Если вы не регистрировались, проигнорируйте это письмо.</p>
    `;
    return wrapHtml(`Здравствуйте, ${name}!`, body, unsub);
  } else {
    const data = arg1 as { name: string; token: string; baseUrl: string };
    const url = `${data.baseUrl}/api/auth/verify?token=${data.token}`;
    const body = `
      <p>Здравствуйте, ${data.name}!</p>
      <p>Спасибо за регистрацию в ${BRAND.name}.</p>
      <p>Для подтверждения email перейдите по ссылке:</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:${BRAND.primaryColor};color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Подтвердить email</a>
      <p style="color:#6b7280;font-size:14px;">Если вы не регистрировались, проигнорируйте это письмо.</p>
    `;
    return { subject: 'Подтвердите email — Nova Anglers Alliance', html: wrapHtml(`Здравствуйте, ${data.name}!`, body) };
  }
}

// Новый стиль (Stage 6.5) — используется в payment-proof маршрутах
export function paymentProofReceivedEmail(data: { athleteName: string; competitionTitle: string; amount: number }) {
  const body = `
    <p>Здравствуйте, ${data.athleteName}!</p>
    <p>Ваш чек на сумму <strong>${data.amount} ₽</strong> за участие в турнире "${data.competitionTitle}" получен.</p>
    <p>Чек находится на проверке. Мы уведомим вас о результате в течение 24 часов.</p>
  `;
  return {
    subject: `Чек получен — ${data.competitionTitle}`,
    html: wrapHtml(`Здравствуйте, ${data.athleteName}!`, body),
  };
}

export function paymentProofConfirmedEmail(data: { athleteName: string; competitionTitle: string; amount?: number; amountKopecks?: number }) {
  const amount = data.amount ?? (data.amountKopecks ? data.amountKopecks / 100 : 0);
  const body = `
    <p>Здравствуйте, ${data.athleteName}!</p>
    <p>Ваша оплата на сумму <strong>${amount} ₽</strong> за участие в турнире "${data.competitionTitle}" <strong style="color:#10b981;">подтверждена</strong>.</p>
    <p>Вы успешно зарегистрированы на турнир. До встречи на соревнованиях!</p>
  `;
  return {
    subject: `Оплата подтверждена — ${data.competitionTitle}`,
    html: wrapHtml(`Здравствуйте, ${data.athleteName}!`, body),
  };
}

export function paymentProofRejectedEmail(data: { athleteName: string; competitionTitle: string; reason?: string }) {
  const body = `
    <p>Здравствуйте, ${data.athleteName}!</p>
    <p>К сожалению, ваш чек за участие в турнире "${data.competitionTitle}" <strong style="color:#ef4444;">отклонён</strong>.</p>
    ${data.reason ? `<p><strong>Причина:</strong> ${data.reason}</p>` : ''}
    <p>Пожалуйста, загрузите корректный чек в личном кабинете.</p>
  `;
  return {
    subject: `Чек отклонён — ${data.competitionTitle}`,
    html: wrapHtml(`Здравствуйте, ${data.athleteName}!`, body),
  };
}

// Универсальный statusUpdateEmail — поддерживает обе сигнатуры
export function statusUpdateEmail(
  data:
    | { athleteName: string; competitionTitle: string; newStatus: string }
    | {
        name: string;
        applicationNumber: string;
        competitionName: string;
        status: string;
        statusLabel: string;
        comment?: string | null;
        cabinetUrl?: string;
        unsubscribeToken?: string;
      }
) {
  // Новая сигнатура
  if ('athleteName' in data) {
    const statusText: Record<string, string> = {
      pending: 'На рассмотрении',
      approved: 'Одобрена',
      rejected: 'Отклонена',
      submitted: 'Принята',
      under_review: 'На проверке',
    };
    const body = `
      <p>Здравствуйте, ${data.athleteName}!</p>
      <p>Статус вашей заявки на турнир "${data.competitionTitle}" изменён на: <strong>${statusText[data.newStatus] || data.newStatus}</strong></p>
    `;
    return {
      subject: `Обновление статуса заявки — ${data.competitionTitle}`,
      html: wrapHtml(`Здравствуйте, ${data.athleteName}!`, body),
    };
  }

  // Старая сигнатура
  const d = data as {
    name: string;
    applicationNumber: string;
    competitionName: string;
    status: string;
    statusLabel: string;
    comment?: string | null;
    cabinetUrl?: string;
    unsubscribeToken?: string;
  };
  const body = `
    <p>Здравствуйте, ${d.name}!</p>
    <p>Статус вашей заявки №${d.applicationNumber} на турнир "${d.competitionName}" изменён на: <strong>${d.statusLabel || d.status}</strong></p>
    ${d.comment ? `<p><strong>Комментарий:</strong> ${d.comment}</p>` : ''}
    ${d.cabinetUrl ? `<p><a href="${d.cabinetUrl}" style="display:inline-block;padding:10px 20px;background:${BRAND.primaryColor};color:#fff;text-decoration:none;border-radius:6px;">Перейти в кабинет</a></p>` : ''}
  `;
  return wrapHtml(`Заявка №${d.applicationNumber}`, body, d.unsubscribeToken);
}

export function paymentReceiptEmail(data: {
  name?: string;
  athleteName?: string;
  amount?: number;
  amountKopecks?: number;
  competitionTitle?: string;
  applicationNumber?: string;
  competitionName?: string;
  currency?: string;
  providerId?: string | null;
  cabinetUrl?: string;
  unsubscribeToken?: string;
}) {
  const athleteName = data.name || data.athleteName || 'Спортсмен';
  const competitionTitle = data.competitionTitle || data.competitionName || 'Турнир';
  const amount =
    data.amount ??
    (typeof data.amountKopecks === 'number' ? data.amountKopecks / 100 : 0);

  // Если старый стиль с кабинетом
  if (data.applicationNumber) {
    const body = `
      <p>Здравствуйте, ${athleteName}!</p>
      <p>Оплата по заявке №${data.applicationNumber} на турнир "${competitionTitle}" на сумму <strong>${amount} ${data.currency || 'RUB'}</strong> получена.</p>
      ${data.providerId ? `<p>ID платежа: ${data.providerId}</p>` : ''}
      ${data.cabinetUrl ? `<p><a href="${data.cabinetUrl}">Кабинет</a></p>` : ''}
    `;
    return wrapHtml(`Чек — заявка №${data.applicationNumber}`, body, data.unsubscribeToken);
  }

  return paymentProofConfirmedEmail({ athleteName, competitionTitle, amount }).html;
}
