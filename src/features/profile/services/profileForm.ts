import { isProvinceCode, type ProvinceCode } from '@/data/turkeyProvinces';
import { militaryTypes, type CompleteUserProfileInput, type MilitaryType, type UserProfile } from '../types/profile';
import {
  isMilitaryPeriodCurrentOrFuture,
  isReportingDateConsistent,
  isReportingDateOnOrAfterPeriodStart,
  isValidBirthYear,
  isValidMilitaryPeriod,
  isValidMilitaryUnit,
  isValidName,
  isValidStoredDate,
  normalizeWhitespace,
  profileFieldLimits,
} from './profileValidation';

export type ProfileFormField =
  | 'firstName'
  | 'lastName'
  | 'birthYear'
  | 'residenceCity'
  | 'departureCity'
  | 'militaryCity'
  | 'militaryType'
  | 'militaryYear'
  | 'militaryMonth'
  | 'militaryUnit'
  | 'reportingDate';

export type ProfileFormErrors = Partial<Record<ProfileFormField, string>>;

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  birthYear: string;
  residenceCity: ProvinceCode | null;
  departureCity: ProvinceCode | null;
  militaryCity: ProvinceCode | null;
  militaryType: MilitaryType | null;
  militaryYear: number | null;
  militaryMonth: number | null;
  knowsMilitaryUnit: boolean;
  militaryUnit: string;
  reportingDate: string | null;
}

interface ProfileFormValidationOptions {
  mode: 'onboarding' | 'edit';
  existingProfile?: UserProfile;
  referenceDate?: Date;
}

export interface ProfileFormResult {
  errors: ProfileFormErrors;
  input: CompleteUserProfileInput | null;
}

export function createProfileFormValues(profile?: UserProfile): ProfileFormValues {
  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    birthYear: profile ? String(profile.birthYear) : '',
    residenceCity: profile?.residenceCity ?? null,
    departureCity: profile?.departureCity ?? null,
    militaryCity: profile?.militaryCity ?? null,
    militaryType: profile?.militaryType ?? null,
    militaryYear: profile?.militaryPeriodYear ?? null,
    militaryMonth: profile?.militaryPeriodMonth ?? null,
    knowsMilitaryUnit: profile?.militaryUnit !== null && profile?.militaryUnit !== undefined,
    militaryUnit: profile?.militaryUnit ?? '',
    reportingDate: profile?.reportingDate ?? null,
  };
}

export function validateProfileForm(
  values: ProfileFormValues,
  options: ProfileFormValidationOptions,
): ProfileFormResult {
  const referenceDate = options.referenceDate ?? new Date();
  const errors: ProfileFormErrors = {};
  const birthYear = Number(values.birthYear);

  if (!isValidName(values.firstName)) {
    errors.firstName = `Ad ${profileFieldLimits.nameMin}-${profileFieldLimits.nameMax} karakter olmalı.`;
  }
  if (!isValidName(values.lastName)) {
    errors.lastName = `Soyad ${profileFieldLimits.nameMin}-${profileFieldLimits.nameMax} karakter olmalı.`;
  }
  if (!isValidBirthYear(birthYear, referenceDate.getFullYear())) {
    errors.birthYear = `${referenceDate.getFullYear() - 100}-${referenceDate.getFullYear() - 18} arasında bir yıl gir.`;
  }
  if (!isProvinceCode(values.residenceCity)) errors.residenceCity = 'Yaşadığın şehri seç.';
  if (!isProvinceCode(values.departureCity)) errors.departureCity = 'Yola çıkacağın şehri seç.';
  if (!isProvinceCode(values.militaryCity)) errors.militaryCity = 'Gideceğin şehri seç.';
  if (!values.militaryType || !militaryTypes.includes(values.militaryType)) {
    errors.militaryType = 'Askerlik türünü seç.';
  }
  if (values.militaryYear === null) errors.militaryYear = 'Celp yılını seç.';
  if (values.militaryMonth === null) errors.militaryMonth = 'Celp ayını seç.';

  const periodValid = isValidMilitaryPeriod(values.militaryYear, values.militaryMonth);
  const existingProfile = options.existingProfile;
  const periodChanged = options.mode === 'edit' && existingProfile
    ? values.militaryYear !== existingProfile.militaryPeriodYear
      || values.militaryMonth !== existingProfile.militaryPeriodMonth
    : true;
  if (
    periodValid
    && (options.mode === 'onboarding' || periodChanged)
    && !isMilitaryPeriodCurrentOrFuture(values.militaryYear, values.militaryMonth, referenceDate)
  ) errors.militaryMonth = 'Geçmiş bir celp dönemi seçilemez.';

  const normalizedUnit = values.knowsMilitaryUnit ? normalizeWhitespace(values.militaryUnit) : null;
  if (values.knowsMilitaryUnit && !isValidMilitaryUnit(normalizedUnit)) {
    errors.militaryUnit = `Birlik adı ${profileFieldLimits.militaryUnitMin}-${profileFieldLimits.militaryUnitMax} karakter olmalı.`;
  }

  if (!values.reportingDate || !isValidStoredDate(values.reportingDate)) {
    errors.reportingDate = 'Geçerli bir teslim tarihi seç.';
  } else if (periodValid) {
    const dateChanged = options.mode === 'edit' && existingProfile
      ? values.reportingDate !== existingProfile.reportingDate
      : true;
    const existingPeriodIsCurrentOrFuture = existingProfile
      ? isMilitaryPeriodCurrentOrFuture(
        existingProfile.militaryPeriodYear,
        existingProfile.militaryPeriodMonth,
        referenceDate,
      )
      : true;
    const validReportingDate = !dateChanged && !periodChanged
      ? true
      : periodChanged || existingPeriodIsCurrentOrFuture
        ? isReportingDateConsistent(values.reportingDate, values.militaryYear, values.militaryMonth, referenceDate)
        : isReportingDateOnOrAfterPeriodStart(values.reportingDate, values.militaryYear, values.militaryMonth);
    if (!validReportingDate) {
      errors.reportingDate = periodChanged || existingPeriodIsCurrentOrFuture
        ? 'Bugünden ve seçtiğin celp döneminden önce olmayan bir tarih seç.'
        : 'Teslim tarihi mevcut celp döneminden önce olamaz.';
    }
  }

  if (Object.keys(errors).length > 0 || !periodValid) return { errors, input: null };

  return {
    errors,
    input: {
      firstName: normalizeWhitespace(values.firstName),
      lastName: normalizeWhitespace(values.lastName),
      birthYear,
      residenceCity: values.residenceCity as ProvinceCode,
      departureCity: values.departureCity as ProvinceCode,
      militaryCity: values.militaryCity as ProvinceCode,
      militaryType: values.militaryType as MilitaryType,
      militaryPeriodYear: values.militaryYear as number,
      militaryPeriodMonth: values.militaryMonth as number,
      militaryUnit: normalizedUnit,
      reportingDate: values.reportingDate as string,
    },
  };
}

export function isProfileFormDirty(values: ProfileFormValues, profile: UserProfile): boolean {
  const result = validateProfileForm(values, { mode: 'edit', existingProfile: profile });
  const input = result.input;
  if (!input) return JSON.stringify(values) !== JSON.stringify(createProfileFormValues(profile));
  return input.firstName !== profile.firstName
    || input.lastName !== profile.lastName
    || input.birthYear !== profile.birthYear
    || input.residenceCity !== profile.residenceCity
    || input.departureCity !== profile.departureCity
    || input.militaryCity !== profile.militaryCity
    || input.militaryType !== profile.militaryType
    || input.militaryPeriodYear !== profile.militaryPeriodYear
    || input.militaryPeriodMonth !== profile.militaryPeriodMonth
    || input.militaryUnit !== profile.militaryUnit
    || input.reportingDate !== profile.reportingDate;
}