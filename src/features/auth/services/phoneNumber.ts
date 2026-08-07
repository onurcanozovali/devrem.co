import { AuthFlowError } from './authErrors';

const turkeyMobilePattern = /^5\d{9}$/;

export function normalizeTurkishPhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  const localNumber = digits.startsWith('90') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;

  if (!turkeyMobilePattern.test(localNumber)) {
    throw new AuthFlowError('invalid-phone-number');
  }

  return `+90${localNumber}`;
}

export function formatTurkishPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '').slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(' ');
}

export function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length !== 12) return '+90 5** *** ** **';
  return `+90 ${digits.slice(2, 3)}** *** ** ${digits.slice(-2)}`;
}
