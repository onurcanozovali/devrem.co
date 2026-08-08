export type PreparationErrorCode =
  | 'permission-denied'
  | 'network-error'
  | 'not-found'
  | 'malformed'
  | 'unknown';

const ERROR_MESSAGES: Record<PreparationErrorCode, string> = {
  'permission-denied': 'Hazırlık listene erişilemedi. Oturumunu kontrol edip tekrar deneyebilirsin.',
  'network-error': 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.',
  'not-found': 'Bu görev artık listede bulunmuyor.',
  malformed: 'Görev bilgileri geçerli değil. Alanları kontrol edip tekrar dene.',
  unknown: 'Hazırlık listesi güncellenirken bir sorun oluştu. Lütfen tekrar dene.',
};

export class PreparationFlowError extends Error {
  readonly code: PreparationErrorCode;

  constructor(code: PreparationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'PreparationFlowError';
    this.code = code;
  }
}

export function mapPreparationError(error: unknown): PreparationFlowError {
  if (error instanceof PreparationFlowError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';

  if (code.includes('permission-denied')) return new PreparationFlowError('permission-denied');
  if (code.includes('unavailable') || code.includes('network')) return new PreparationFlowError('network-error');
  if (code.includes('not-found')) return new PreparationFlowError('not-found');
  if (code.includes('invalid-argument')) return new PreparationFlowError('malformed');
  return new PreparationFlowError('unknown');
}
