export const profilePhotoSize = 512;
export const profilePhotoMaxBytes = 1024 * 1024;

export type ProfilePhotoErrorCode =
  | 'permission-denied'
  | 'invalid-image'
  | 'network'
  | 'unavailable'
  | 'unknown';

const messages: Record<ProfilePhotoErrorCode, string> = {
  'permission-denied': 'Fotoğraflara erişim izni verilmedi. Ayarlardan izin verip tekrar deneyin.',
  'invalid-image': 'Bu fotoğraf kullanılamadı. Lütfen başka bir fotoğraf seçin.',
  network: 'Fotoğraf yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  unavailable: 'Fotoğraf işlemi şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin.',
  unknown: 'Fotoğraf işlemi tamamlanamadı. Lütfen tekrar deneyin.',
};

export class ProfilePhotoFlowError extends Error {
  constructor(public readonly code: ProfilePhotoErrorCode) {
    super(messages[code]);
    this.name = 'ProfilePhotoFlowError';
  }
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function mapProfilePhotoError(error: unknown): ProfilePhotoFlowError {
  if (error instanceof ProfilePhotoFlowError) return error;

  switch (readErrorCode(error)) {
    case 'ERR_NO_LIBRARY_PERMISSION':
    case 'storage/unauthorized':
      return new ProfilePhotoFlowError('permission-denied');
    case 'storage/retry-limit-exceeded':
    case 'storage/network-request-failed':
      return new ProfilePhotoFlowError('network');
    case 'storage/quota-exceeded':
    case 'storage/project-not-found':
    case 'storage/bucket-not-found':
      return new ProfilePhotoFlowError('unavailable');
    default:
      return new ProfilePhotoFlowError('unknown');
  }
}

export function getProfilePhotoPath(uid: string): string {
  return `users/${uid}/profile/avatar.jpg`;
}

export function isValidProfilePhotoPath(uid: string, value: unknown): value is string | null {
  return value === null || value === getProfilePhotoPath(uid);
}

export function getProfileInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName.trim().charAt(0);
  const lastInitial = lastName.trim().charAt(0);
  return `${firstInitial}${lastInitial}`.toLocaleUpperCase('tr-TR') || '?';
}