export interface PublicProfileProjection {
  firstName: string;
  residenceCity: number;
  departureCity: number;
  militaryCity: number;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryType: 'standard' | 'paid' | 'reserveOfficer' | 'reserveNco';
  militaryUnit: string | null;
  photoPath: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isProvinceCode(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 81;
}

function isMilitaryType(value: unknown): value is PublicProfileProjection['militaryType'] {
  return value === 'standard' || value === 'paid' || value === 'reserveOfficer' || value === 'reserveNco';
}

export function createPublicProfileProjection(
  uid: string,
  value: unknown,
): PublicProfileProjection | null {
  if (!uid || !isRecord(value) || value.onboardingCompleted !== true) return null;
  const firstName = typeof value.firstName === 'string' ? normalizeWhitespace(value.firstName) : '';
  const militaryUnit = typeof value.militaryUnit === 'string'
    ? normalizeWhitespace(value.militaryUnit)
    : value.militaryUnit;
  const photoPath = value.photoPath ?? null;
  if (
    firstName.length < 2
    || firstName.length > 50
    || !isProvinceCode(value.residenceCity)
    || !isProvinceCode(value.departureCity)
    || !isProvinceCode(value.militaryCity)
    || typeof value.militaryPeriodYear !== 'number'
    || !Number.isInteger(value.militaryPeriodYear)
    || value.militaryPeriodYear < 2020
    || value.militaryPeriodYear > 2100
    || typeof value.militaryPeriodMonth !== 'number'
    || !Number.isInteger(value.militaryPeriodMonth)
    || value.militaryPeriodMonth < 1
    || value.militaryPeriodMonth > 12
    || !isMilitaryType(value.militaryType)
    || !(militaryUnit === null || (typeof militaryUnit === 'string' && militaryUnit.length >= 2 && militaryUnit.length <= 120))
    || !(photoPath === null || photoPath === `users/${uid}/profile/avatar.jpg`)
  ) return null;

  return {
    firstName,
    residenceCity: value.residenceCity,
    departureCity: value.departureCity,
    militaryCity: value.militaryCity,
    militaryPeriodYear: value.militaryPeriodYear,
    militaryPeriodMonth: value.militaryPeriodMonth,
    militaryType: value.militaryType,
    militaryUnit,
    photoPath,
  };
}