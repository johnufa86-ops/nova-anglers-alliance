export function getPaymentConfig() {
  return {
    isOnlineEnabled: process.env.PAYMENT_ONLINE_ENABLED === 'true',
    isBankTransferEnabled: process.env.PAYMENT_BANK_TRANSFER_ENABLED !== 'false',
    timeoutHours: parseInt(process.env.BANK_TRANSFER_TIMEOUT_HOURS || '48', 10),
  };
}
