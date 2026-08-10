export type DevreMilitaryType = 'standard' | 'paid' | 'reserveOfficer' | 'reserveNco';

export interface DevreIdentityInput {
  militaryCity: number;
  militaryPeriodMonth: number;
  militaryPeriodYear: number;
  militaryType: DevreMilitaryType;
  militaryUnitId: string | null;
  militaryUnitName: string | null;
}

export function normalizeDevreWhitespace(value: string): string;
export function getDevreIdentityKey(profile: DevreIdentityInput | null): string | null;
export function hasExactDevreIdentity(reference: DevreIdentityInput, candidate: DevreIdentityInput): boolean;
