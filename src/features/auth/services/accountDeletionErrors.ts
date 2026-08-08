export type AccountDeletionErrorCode =
  | 'recent-auth-required'
  | 'unauthenticated'
  | 'network'
  | 'unavailable'
  | 'session-clear-failed'
  | 'unknown';

const messages: Record<AccountDeletionErrorCode, string> = {
  'recent-auth-required': 'Güvenliğin için telefon numaranı yeniden doğrulaman gerekiyor.',
  unauthenticated: 'Oturumun sona ermiş. Lütfen yeniden giriş yapıp tekrar dene.',
  network: 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.',
  unavailable: 'Hesap silme işlemi şu anda tamamlanamadı. Biraz sonra tekrar dene.',
  'session-clear-failed': 'Hesabın silindi ancak bu cihazdaki oturum kapatılamadı. Uygulamayı yeniden başlat.',
  unknown: 'Hesap silme işlemi tamamlanamadı. Lütfen tekrar dene.',
};

export class AccountDeletionError extends Error {
  constructor(public readonly code: AccountDeletionErrorCode) {
    super(messages[code]);
    this.name = 'AccountDeletionError';
  }
}