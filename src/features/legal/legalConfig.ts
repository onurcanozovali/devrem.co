import legalEntity from './legalEntity.json';

export const LEGAL_VERSIONS = {
  terms: '2026-08-20-v1',
  privacyNotice: '2026-08-20-v1',
} as const;

export const LEGAL_ENTITY = legalEntity;

const legalEntityPlaceholder = 'FILL_BEFORE_PRODUCTION';

export function getMissingLegalEntityFields(): string[] {
  return Object.entries(LEGAL_ENTITY)
    .filter(([, value]) => value.trim() === legalEntityPlaceholder)
    .map(([key]) => key);
}

export function validateLegalEntityConfigForProduction(environment: string | undefined): void {
  if (environment !== 'production') return;
  const missingFields = getMissingLegalEntityFields();
  if (missingFields.length > 0) {
    throw new Error(`Production legal entity configuration is incomplete: ${missingFields.join(', ')}.`);
  }
}
