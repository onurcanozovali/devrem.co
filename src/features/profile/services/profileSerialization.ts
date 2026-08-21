import { isProvinceCode } from '@/data/turkeyProvinces';
import { getMilitaryUnitById } from '@/features/militaryUnits/catalog';
import { forceCodes, type ForceCode } from '@/features/militaryUnits/types';
import {
  isReportingDateConsistent,
  isMilitaryPeriodCurrentOrFuture,
  isValidBirthYear,
  isValidMilitaryPeriod,
  isValidName,
  isValidOptionalMilitaryUnit,
  isValidStoredDate,
  normalizeWhitespace,
} from './profileValidation';
import {
  militaryTypes,
  type CompleteUserProfileInput,
  type MilitaryType,
  type UserProfile,
} from '../types/profile';
import { createProfileFormValues, validateProfileForm } from './profileForm';
import { isValidProfilePhotoPath } from './profilePhotoDomain';

interface LegacyMilitaryPeriod {
  year: number;
  month: number;
}

export interface SerializedProfileData
  extends Omit<
    CompleteUserProfileInput,
    'militaryUnitId' | 'militaryUnitNameSnapshot' | 'forceCode'
  > {
  uid: string;
  militaryUnitId: string | null;
  militaryUnitNameSnapshot: string | null;
  forceCode: ForceCode | null;
  photoPath: string | null;
  onboardingCompleted: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
}

function isForceCode(value: unknown): value is ForceCode {
  return typeof value === 'string' && forceCodes.some((code) => code === value);
}

function getCanonicalAssignment(input: CompleteUserProfileInput): {
  militaryUnit: string | null;
  militaryUnitId: string | null;
  militaryUnitNameSnapshot: string | null;
  forceCode: ForceCode | null;
} | null {
  const normalizedUnit = input.militaryUnit === null ? null : normalizeWhitespace(input.militaryUnit);
  const unitId = input.militaryUnitId ?? null;
  if (!unitId) {
    return {
      militaryUnit: normalizedUnit,
      militaryUnitId: null,
      militaryUnitNameSnapshot: normalizedUnit,
      forceCode: null,
    };
  }
  const unit = getMilitaryUnitById(unitId);
  if (!unit || unit.cityCode !== input.militaryCity) return null;
  return {
    militaryUnit: unit.name,
    militaryUnitId: unit.id,
    militaryUnitNameSnapshot: unit.name,
    forceCode: unit.forceCode,
  };
}

function parseLegacyMilitaryPeriod(value: unknown): LegacyMilitaryPeriod | null {
  if (!isRecord(value)) return null;
  const year = value.year;
  const month = value.month;
  if (
    typeof year !== 'number'
    || typeof month !== 'number'
    || !isValidMilitaryPeriod(year, month)
  ) return null;
  return { year, month };
}

function readMilitaryPeriod(data: Record<string, unknown>): LegacyMilitaryPeriod | null {
  const year = data.militaryPeriodYear;
  const month = data.militaryPeriodMonth;
  if (
    typeof year === 'number'
    && typeof month === 'number'
    && isValidMilitaryPeriod(year, month)
  ) {
    return { year, month };
  }
  return parseLegacyMilitaryPeriod(data.militaryPeriod);
}

export function parseCompletedProfileData(
  uid: string,
  value: unknown,
): SerializedProfileData | null {
  if (!isRecord(value) || value.uid !== uid || value.onboardingCompleted !== true) return null;

  const period = readMilitaryPeriod(value);
  const photoPath = value.photoPath ?? null;
  const militaryUnitId = value.militaryUnitId ?? null;
  const militaryUnitNameSnapshot = value.militaryUnitNameSnapshot ?? value.militaryUnit ?? null;
  const forceCode = value.forceCode ?? null;
  const canonicalUnit = typeof militaryUnitId === 'string' ? getMilitaryUnitById(militaryUnitId) : null;
  if (
    !period
    || !isValidName(value.firstName)
    || !isValidName(value.lastName)
    || !isValidBirthYear(value.birthYear)
    || !isProvinceCode(value.residenceCity)
    || !isProvinceCode(value.departureCity)
    || !isProvinceCode(value.militaryCity)
    || !isMilitaryType(value.militaryType)
    || !isValidOptionalMilitaryUnit(value.militaryUnit)
    || !(militaryUnitId === null || typeof militaryUnitId === 'string')
    || !isValidOptionalMilitaryUnit(militaryUnitNameSnapshot)
    || !(forceCode === null || isForceCode(forceCode))
    || (militaryUnitId !== null && (!canonicalUnit || canonicalUnit.cityCode !== value.militaryCity || canonicalUnit.forceCode !== forceCode))
    || !isValidStoredDate(value.reportingDate)
    || !isValidProfilePhotoPath(uid, photoPath)
  ) return null;

  return {
    uid,
    firstName: normalizeWhitespace(value.firstName),
    lastName: normalizeWhitespace(value.lastName),
    birthYear: value.birthYear,
    residenceCity: value.residenceCity,
    departureCity: value.departureCity,
    militaryCity: value.militaryCity,
    militaryType: value.militaryType,
    militaryPeriodYear: period.year,
    militaryPeriodMonth: period.month,
    militaryUnit: value.militaryUnit === null ? null : normalizeWhitespace(value.militaryUnit),
    militaryUnitId: militaryUnitId === null ? null : militaryUnitId,
    militaryUnitNameSnapshot: canonicalUnit?.name ?? (militaryUnitNameSnapshot === null ? null : normalizeWhitespace(militaryUnitNameSnapshot)),
    forceCode: canonicalUnit?.forceCode ?? null,
    reportingDate: value.reportingDate,
    photoPath,
    onboardingCompleted: true,
  };
}

export function serializeCompletedProfileData(
  uid: string,
  input: CompleteUserProfileInput,
  referenceDate = new Date(),
): SerializedProfileData | null {
  const assignment = getCanonicalAssignment(input);
  if (
    !uid
    || !isValidName(input.firstName)
    || !isValidName(input.lastName)
    || !isValidBirthYear(input.birthYear, referenceDate.getFullYear())
    || !isProvinceCode(input.residenceCity)
    || !isProvinceCode(input.departureCity)
    || !isProvinceCode(input.militaryCity)
    || !isMilitaryType(input.militaryType)
    || !isMilitaryPeriodCurrentOrFuture(
      input.militaryPeriodYear,
      input.militaryPeriodMonth,
      referenceDate,
    )
    || !isValidOptionalMilitaryUnit(input.militaryUnit)
    || !assignment
    || !isReportingDateConsistent(
      input.reportingDate,
      input.militaryPeriodYear,
      input.militaryPeriodMonth,
      referenceDate,
    )
  ) return null;

  return {
    uid,
    firstName: normalizeWhitespace(input.firstName),
    lastName: normalizeWhitespace(input.lastName),
    birthYear: input.birthYear,
    residenceCity: input.residenceCity,
    departureCity: input.departureCity,
    militaryCity: input.militaryCity,
    militaryType: input.militaryType,
    militaryPeriodYear: input.militaryPeriodYear,
    militaryPeriodMonth: input.militaryPeriodMonth,
    ...assignment,
    reportingDate: input.reportingDate,
    photoPath: null,
    onboardingCompleted: true,
  };
}

export function serializeUpdatedProfileData(
  uid: string,
  input: CompleteUserProfileInput,
  existingProfile: UserProfile,
  referenceDate = new Date(),
): SerializedProfileData | null {
  if (!uid || uid !== existingProfile.uid) return null;

  const candidateProfile: UserProfile = {
    ...existingProfile,
    ...input,
  };
  const result = validateProfileForm(createProfileFormValues(candidateProfile), {
    mode: 'edit',
    existingProfile,
    referenceDate,
  });
  if (!result.input) return null;

  const assignment = getCanonicalAssignment(input);
  if (!assignment) return null;

  return {
    uid,
    ...result.input,
    ...assignment,
    photoPath: existingProfile.photoPath,
    onboardingCompleted: true,
  };
}
