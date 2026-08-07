import type { ProfileErrorCode } from '../types/profile';

const messages: Record<ProfileErrorCode, string> = {
  network: 'Profil bilgileri yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  'permission-denied': 'Profil bilgilerine erişim izni alınamadı. Lütfen yeniden giriş yapmayı deneyin.',
  unavailable: 'Profil hizmetine şu anda ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.',
  malformed: 'Profil verileri beklenen biçimde değil. Lütfen destek ekibiyle iletişime geçin.',
  unknown: 'Profil işlemi tamamlanamadı. Lütfen tekrar deneyin.',
};

export class ProfileFlowError extends Error {
  constructor(public readonly code: ProfileErrorCode) {
    super(messages[code]);
    this.name = 'ProfileFlowError';
  }
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function mapProfileError(error: unknown): ProfileFlowError {
  if (error instanceof ProfileFlowError) return error;

  switch (readErrorCode(error)) {
    case 'firestore/network-request-failed':
      return new ProfileFlowError('network');
    case 'firestore/permission-denied':
      return new ProfileFlowError('permission-denied');
    case 'firestore/unavailable':
    case 'firestore/deadline-exceeded':
      return new ProfileFlowError('unavailable');
    default:
      return new ProfileFlowError('unknown');
  }
}
