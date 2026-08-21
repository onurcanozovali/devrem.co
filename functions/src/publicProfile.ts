export interface PublicProfileProjection {
  firstName: string;
  lastName: string;
  residenceCity: number;
  departureCity: number;
  militaryCity: number;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryType: 'standard' | 'paid' | 'reserveOfficer' | 'reserveNco';
  militaryUnitId: string | null;
  militaryUnitName: string | null;
  forceCode: 'land' | 'air' | 'navy' | 'gendarmerie' | 'coast_guard' | null;
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

function isForceCode(value: unknown): value is NonNullable<PublicProfileProjection['forceCode']> {
  return value === 'land' || value === 'air' || value === 'navy' || value === 'gendarmerie' || value === 'coast_guard';
}

export function createPublicProfileProjection(
  uid: string,
  value: unknown,
): PublicProfileProjection | null {
  if (!uid || !isRecord(value) || value.onboardingCompleted !== true) return null;
  const firstName = typeof value.firstName === 'string' ? normalizeWhitespace(value.firstName) : '';
  const lastName = typeof value.lastName === 'string' ? normalizeWhitespace(value.lastName) : '';
  const rawMilitaryUnitId = value.militaryUnitId ?? null;
  const militaryUnitId = typeof rawMilitaryUnitId === 'string' ? normalizeWhitespace(rawMilitaryUnitId) : rawMilitaryUnitId;
  const unitNameValue = value.militaryUnitNameSnapshot ?? value.militaryUnit;
  const militaryUnitName = typeof unitNameValue === 'string'
    ? normalizeWhitespace(unitNameValue)
    : unitNameValue;
  const forceCode = value.forceCode ?? null;
  const photoPath = value.photoPath ?? null;
  if (
    firstName.length < 2
    || firstName.length > 50
    || lastName.length < 2
    || lastName.length > 50
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
    || !(militaryUnitId === null || (typeof militaryUnitId === 'string' && militaryUnitId.length >= 3 && militaryUnitId.length <= 160))
    || !(militaryUnitName === null || (typeof militaryUnitName === 'string' && militaryUnitName.length >= 2 && militaryUnitName.length <= 120))
    || !(forceCode === null || isForceCode(forceCode))
    || !(photoPath === null || photoPath === `users/${uid}/profile/avatar.jpg`)
  ) return null;

  return {
    firstName,
    lastName,
    residenceCity: value.residenceCity,
    departureCity: value.departureCity,
    militaryCity: value.militaryCity,
    militaryPeriodYear: value.militaryPeriodYear,
    militaryPeriodMonth: value.militaryPeriodMonth,
    militaryType: value.militaryType,
    militaryUnitId: militaryUnitId as string | null,
    militaryUnitName,
    forceCode,
    photoPath,
  };
}
