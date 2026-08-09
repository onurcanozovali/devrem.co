export type DiscoveryErrorCode = 'network' | 'permission-denied' | 'unavailable' | 'unknown';

const messages: Record<DiscoveryErrorCode, string> = {
  network: 'Devreler yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.',
  'permission-denied': 'Devreleri görüntülemek için hesabınla yeniden giriş yapman gerekiyor.',
  unavailable: 'Devreler şu anda yüklenemiyor. Lütfen biraz sonra tekrar dene.',
  unknown: 'Devreler yüklenirken bir sorun oluştu. Lütfen tekrar dene.',
};

export class DiscoveryFlowError extends Error {
  constructor(public readonly code: DiscoveryErrorCode) {
    super(messages[code]);
    this.name = 'DiscoveryFlowError';
  }
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function mapDiscoveryError(error: unknown): DiscoveryFlowError {
  if (error instanceof DiscoveryFlowError) return error;
  switch (readErrorCode(error)) {
    case 'firestore/permission-denied':
      return new DiscoveryFlowError('permission-denied');
    case 'firestore/network-request-failed':
      return new DiscoveryFlowError('network');
    case 'firestore/unavailable':
    case 'firestore/resource-exhausted':
      return new DiscoveryFlowError('unavailable');
    default:
      return new DiscoveryFlowError('unknown');
  }
}