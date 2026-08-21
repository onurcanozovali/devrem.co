import { LEGAL_VERSIONS } from './legalConfig';

export type LegalDocumentId = 'terms' | 'privacy-notice';

export interface RegistrationLegalState {
  termsAccepted: boolean;
  privacyNoticeAcknowledged: boolean;
}

export interface LegalAcceptanceRecord {
  termsAcceptedVersion: string;
  termsAcceptedAt: Date | null;
  privacyNoticeAcknowledgedVersion: string;
  privacyNoticeAcknowledgedAt: Date | null;
}

export function createCurrentLegalAcceptanceWrite<T>(timestamp: T) {
  return {
    termsAcceptedVersion: LEGAL_VERSIONS.terms,
    termsAcceptedAt: timestamp,
    privacyNoticeAcknowledgedVersion: LEGAL_VERSIONS.privacyNotice,
    privacyNoticeAcknowledgedAt: timestamp,
  };
}

export function createRegistrationLegalState(): RegistrationLegalState {
  return { termsAccepted: false, privacyNoticeAcknowledged: false };
}

export function canSubmitRegistration(state: RegistrationLegalState): boolean {
  return state.termsAccepted && state.privacyNoticeAcknowledged;
}

export function isCurrentLegalAcceptance(record: LegalAcceptanceRecord | null): boolean {
  return record?.termsAcceptedVersion === LEGAL_VERSIONS.terms
    && record.termsAcceptedAt instanceof Date
    && record.privacyNoticeAcknowledgedVersion === LEGAL_VERSIONS.privacyNotice
    && record.privacyNoticeAcknowledgedAt instanceof Date;
}

export function getLegalDocumentPath(documentId: LegalDocumentId): '/legal/terms' | '/legal/privacy-notice' {
  return documentId === 'terms' ? '/legal/terms' : '/legal/privacy-notice';
}

export function isLegalDocumentId(value: unknown): value is LegalDocumentId {
  return value === 'terms' || value === 'privacy-notice';
}
