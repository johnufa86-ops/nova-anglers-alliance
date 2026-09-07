// Брендирование
export const BRAND = {
  name: 'Nova Anglers Alliance',
  logoUrl: '/logo.png',
  primaryColor: '#2563eb',
  supportEmail: 'support@nova-anglers.ru',
};

// Цвета статусов
export const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  paid: '#10b981',
  awaiting_review: '#3b82f6',
  confirmed: '#10b981',
};

// Письмо подтверждения email
export function verificationEmail(data: { name: string; token: string; baseUrl: string }) {
  return {
    subject: 'Подтвердите email — Nova Anglers Alliance',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Здравствуйте, ${data.name}!</h2>
        <p>Спасибо за регистрацию в Nova Anglers Alliance.</p>
        <p>Для подтверждения email перейдите по ссылке:</p>
        <a href="${data.baseUrl}/api/auth/verify?token=${data.token}" 
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Подтвердить email
        </a>
        <p style="color: #6b7280; font-size: 14px;">Если вы не регистрировались, проигнорируйте это письмо.</p>
      </div>
    `,
  };
}

// Письмо о получении чека
export function paymentProofReceivedEmail(data: { athleteName: string; competitionTitle: string; amount: number }) {
  return {
    subject: `Чек получен — ${data.competitionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Здравствуйте, ${data.athleteName}!</h2>
        <p>Ваш чек на сумму <strong>${data.amount} ₽</strong> за участие в турнире "${data.competitionTitle}" получен.</p>
        <p>Чек находится на проверке. Мы уведомим вас о результате в течение 24 часов.</p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          С уважением,<br>Команда Nova Anglers Alliance
        </p>
      </div>
    `,
  };
}

// Письмо о подтверждении оплаты
export function paymentProofConfirmedEmail(data: { athleteName: string; competitionTitle: string; amount: number }) {
  return {
    subject: `Оплата подтверждена — ${data.competitionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Здравствуйте, ${data.athleteName}!</h2>
        <p>Ваша оплата на сумму <strong>${data.amount} ₽</strong> за участие в турнире "${data.competitionTitle}" <strong style="color: #10b981;">подтверждена</strong>.</p>
        <p>Вы успешно зарегистрированы на турнир. До встречи на соревнованиях!</p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          С уважением,<br>Команда Nova Anglers Alliance
        </p>
      </div>
    `,
  };
}

// Письмо об отклонении чека
export function paymentProofRejectedEmail(data: { athleteName: string; competitionTitle: string; reason?: string }) {
  return {
    subject: `Чек отклонён — ${data.competitionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Здравствуйте, ${data.athleteName}!</h2>
        <p>К сожалению, ваш чек за участие в турнире "${data.competitionTitle}" <strong style="color: #ef4444;">отклонён</strong>.</p>
        ${data.reason ? `<p><strong>Причина:</strong> ${data.reason}</p>` : ''}
        <p>Пожалуйста, загрузите корректный чек в личном кабинете.</p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          С уважением,<br>Команда Nova Anglers Alliance
        </p>
      </div>
    `,
  };
}

// Письмо об обновлении статуса заявки
export function statusUpdateEmail(data: { athleteName: string; competitionTitle: string; newStatus: string }) {
  const statusText: Record<string, string> = {
    pending: 'На рассмотрении',
    approved: 'Одобрена',
    rejected: 'Отклонена',
  };

  return {
    subject: `Обновление статуса заявки — ${data.competitionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Здравствуйте, ${data.athleteName}!</h2>
        <p>Статус вашей заявки на турнир "${data.competitionTitle}" изменён на: <strong>${statusText[data.newStatus] || data.newStatus}</strong></p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          С уважением,<br>Команда Nova Anglers Alliance
        </p>
      </div>
    `,
  };
}

// Письмо о подтверждении оплаты (альтернативное название)
export function paymentReceiptEmail(data: { athleteName: string; amount: number; competitionTitle: string }) {
  return paymentProofConfirmedEmail(data);
}