export function validateBankDetails(data: {
  accountNumber: string;
  bik: string;
  inn?: string | null;
}) {
  const errors: string[] = [];
  if (!/^\d{20}$/.test(data.accountNumber || '')) {
    errors.push('Расчетный счет должен состоять ровно из 20 цифр');
  }
  if (!/^\d{9}$/.test(data.bik || '')) {
    errors.push('БИК должен состоять ровно из 9 цифр');
  }
  if (data.inn && !/^(\d{10}|\d{12})$/.test(data.inn)) {
    errors.push('ИНН должен состоять из 10 или 12 цифр');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}
