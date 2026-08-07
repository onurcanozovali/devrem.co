import type { AuthErrorCode } from '../types/auth';

const messages: Record<AuthErrorCode, string> = {
  'invalid-phone-number': 'Geçerli bir Türkiye cep telefonu numarası girin.',
  'network-request-failed': 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  'invalid-verification-code': 'Doğrulama kodu hatalı. Kodu kontrol edip tekrar deneyin.',
  'verification-code-expired': 'Doğrulama kodunun süresi doldu. Yeni bir kod isteyin.',
  'too-many-requests': 'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.',
  'quota-exceeded': 'SMS gönderim sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.',
  'verification-cancelled': 'Telefon doğrulaması iptal edildi. Tekrar deneyebilirsiniz.',
  'verification-session-expired': 'Doğrulama oturumu sona erdi. Telefon numaranızı yeniden girin.',
  'configuration-error': 'Telefon doğrulama yapılandırması tamamlanmamış. Lütfen uygulama yöneticisine bildirin.',
  unknown: 'Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.',
};

export class AuthFlowError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(messages[code]);
    this.name = 'AuthFlowError';
  }
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function mapAuthError(error: unknown): AuthFlowError {
  if (error instanceof AuthFlowError) return error;

  switch (readErrorCode(error)) {
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return new AuthFlowError('invalid-phone-number');
    case 'auth/network-request-failed':
      return new AuthFlowError('network-request-failed');
    case 'auth/invalid-verification-code':
      return new AuthFlowError('invalid-verification-code');
    case 'auth/code-expired':
    case 'auth/session-expired':
      return new AuthFlowError('verification-code-expired');
    case 'auth/too-many-requests':
      return new AuthFlowError('too-many-requests');
    case 'auth/quota-exceeded':
      return new AuthFlowError('quota-exceeded');
    case 'auth/web-context-cancelled':
    case 'auth/cancelled-popup-request':
      return new AuthFlowError('verification-cancelled');
    case 'auth/app-not-authorized':
    case 'auth/missing-client-identifier':
    case 'auth/operation-not-allowed':
    case 'app/no-app':
      return new AuthFlowError('configuration-error');
    default:
      return new AuthFlowError('unknown');
  }
}
