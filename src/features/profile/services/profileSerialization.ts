import { isProvinceCode } from '@/data/turkeyProvinces';
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

interface LegacyMilitaryPeriod {
  year: number;
  month: number;
}

export interface SerializedProfileData extends CompleteUserProfileInput {
  uid: string;
  onboardingCompleted: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
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
    || !isValidStoredDate(value.reportingDate)
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
    reportingDate: value.reportingDate,
    onboardingCompleted: true,
  };
}

export function serializeCompletedProfileData(
  uid: string,
  input: CompleteUserProfileInput,
  referenceDate = new Date(),
): SerializedProfileData | null {
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
    militaryUnit: input.militaryUnit === null ? null : normalizeWhitespace(input.militaryUnit),
    reportingDate: input.reportingDate,
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

  return {
    uid,
    ...result.input,
    onboardingCompleted: true,
  };
}
