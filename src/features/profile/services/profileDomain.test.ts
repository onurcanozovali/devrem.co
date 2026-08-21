/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { turkeyProvinces } from '@/data/turkeyProvinces';
import { createMilitaryMonthOptions, createMilitaryYearOptions } from '../profileOptions';
import type { CompleteUserProfileInput, UserProfile } from '../types/profile';
import { createProfileFormValues, isProfileFormDirty, validateProfileForm } from './profileForm';
import {
  parseCompletedProfileData,
  serializeCompletedProfileData,
  serializeUpdatedProfileData,
} from './profileSerialization';
import { getProfileInitials, getProfilePhotoPath } from './profilePhotoDomain';
import {
  getMinimumReportingDate,
  isMilitaryPeriodCurrentOrFuture,
  isReportingDateConsistent,
  isValidBirthYear,
  localDateToStoredDate,
  normalizeWhitespace,
} from './profileValidation';

const referenceDate = new Date(2026, 7, 8, 15, 30);
const validInput: CompleteUserProfileInput = {
  firstName: '  Onur  Can ',
  lastName: ' Özovalı ',
  birthYear: 2000,
  residenceCity: 34,
  departureCity: 34,
  militaryCity: 6,
  militaryType: 'standard',
  militaryPeriodYear: 2026,
  militaryPeriodMonth: 8,
  militaryUnit: null,
  reportingDate: '2026-08-08',
};

const historicalProfile: UserProfile = {
  ...validInput,
  uid: 'user-1',
  firstName: 'Onur Can',
  lastName: 'Özovalı',
  militaryPeriodYear: 2025,
  militaryPeriodMonth: 7,
  reportingDate: '2025-07-10',
  militaryUnitId: null,
  militaryUnitNameSnapshot: null,
  forceCode: null,
  photoPath: null,
  onboardingCompleted: true,
  createdAt: null,
  updatedAt: null,
};

test('controlled province data contains all 81 unique plate codes', () => {
  assert.equal(turkeyProvinces.length, 81);
  assert.equal(new Set(turkeyProvinces.map(({ code }) => code)).size, 81);
  assert.deepEqual(turkeyProvinces.map(({ code }) => code), Array.from({ length: 81 }, (_, index) => index + 1));
});

test('birth year and whitespace validation stay deterministic', () => {
  assert.equal(normalizeWhitespace('  Onur   Can  '), 'Onur Can');
  assert.equal(isValidBirthYear(1926, 2026), true);
  assert.equal(isValidBirthYear(2008, 2026), true);
  assert.equal(isValidBirthYear(2009, 2026), false);
  assert.equal(isValidBirthYear(2027, 2026), false);
});

test('new onboarding never offers a past military period', () => {
  assert.deepEqual(createMilitaryYearOptions(referenceDate).map(({ value }) => value), [2026, 2027, 2028, 2029, 2030, 2031]);
  assert.deepEqual(createMilitaryMonthOptions(2026, referenceDate).map(({ value }) => value), [8, 9, 10, 11, 12]);
  assert.equal(createMilitaryMonthOptions(2025, referenceDate).length, 0);
  assert.equal(createMilitaryMonthOptions(2027, referenceDate).length, 12);
  assert.equal(isMilitaryPeriodCurrentOrFuture(2026, 7, referenceDate), false);
  assert.equal(isMilitaryPeriodCurrentOrFuture(2026, 8, referenceDate), true);
  assert.equal(isMilitaryPeriodCurrentOrFuture(2027, 1, referenceDate), true);
});

test('edit options retain only the stored historical period alongside current choices', () => {
  assert.deepEqual(
    createMilitaryYearOptions(referenceDate, 2025).map(({ value }) => value),
    [2025, 2026, 2027, 2028, 2029, 2030, 2031],
  );
  assert.deepEqual(
    createMilitaryMonthOptions(2025, referenceDate, { year: 2025, month: 7 }).map(({ value }) => value),
    [7],
  );
});

test('editing unrelated fields preserves an unchanged historical period and reporting date', () => {
  const values = createProfileFormValues(historicalProfile);
  values.firstName = '  Yeni   Ad  ';
  const result = validateProfileForm(values, {
    mode: 'edit',
    existingProfile: historicalProfile,
    referenceDate,
  });
  assert.deepEqual(result.errors, {});
  assert.equal(result.input?.firstName, 'Yeni Ad');
  assert.equal(result.input?.militaryPeriodYear, 2025);
  assert.equal(result.input?.reportingDate, '2025-07-10');
});

test('editing a historical profile cannot select another past period', () => {
  const values = createProfileFormValues(historicalProfile);
  values.militaryMonth = 8;
  values.reportingDate = '2025-08-01';
  const result = validateProfileForm(values, {
    mode: 'edit',
    existingProfile: historicalProfile,
    referenceDate,
  });
  assert.equal(result.input, null);
  assert.equal(result.errors.militaryMonth, 'Geçmiş bir celp dönemi seçilemez.');
});

test('update serializer preserves an unchanged historical period and enforces profile ownership', () => {
  const serialized = serializeUpdatedProfileData('user-1', {
    ...historicalProfile,
    firstName: '  Yeni   Ad  ',
  }, historicalProfile, referenceDate);
  assert.equal(serialized?.firstName, 'Yeni Ad');
  assert.equal(serialized?.militaryPeriodYear, 2025);
  assert.equal(serialized?.militaryPeriodMonth, 7);
  assert.equal(serializeUpdatedProfileData('user-2', historicalProfile, historicalProfile, referenceDate), null);
});

test('update serializer rejects changing a historical profile to another past period', () => {
  assert.equal(serializeUpdatedProfileData('user-1', {
    ...historicalProfile,
    militaryPeriodMonth: 8,
    reportingDate: '2025-08-10',
  }, historicalProfile, referenceDate), null);
});

test('editing only a historical reporting date validates against its stored period', () => {
  const values = createProfileFormValues(historicalProfile);
  values.reportingDate = '2025-07-20';
  assert.ok(validateProfileForm(values, {
    mode: 'edit',
    existingProfile: historicalProfile,
    referenceDate,
  }).input);

  values.reportingDate = '2025-06-30';
  assert.equal(validateProfileForm(values, {
    mode: 'edit',
    existingProfile: historicalProfile,
    referenceDate,
  }).errors.reportingDate, 'Teslim tarihi mevcut celp döneminden önce olamaz.');
});

test('dirty tracking compares normalized persisted values', () => {
  const values = createProfileFormValues(historicalProfile);
  values.firstName = `  ${historicalProfile.firstName}  `;
  assert.equal(isProfileFormDirty(values, historicalProfile), false);
  values.departureCity = 35;
  assert.equal(isProfileFormDirty(values, historicalProfile), true);
});

test('reporting dates use local calendar parts and respect today and celp period', () => {
  assert.equal(localDateToStoredDate(referenceDate), '2026-08-08');
  assert.equal(localDateToStoredDate(getMinimumReportingDate(2026, 8, referenceDate)), '2026-08-08');
  assert.equal(localDateToStoredDate(getMinimumReportingDate(2026, 10, referenceDate)), '2026-10-01');
  assert.equal(isReportingDateConsistent('2026-08-07', 2026, 8, referenceDate), false);
  assert.equal(isReportingDateConsistent('2026-09-30', 2026, 10, referenceDate), false);
  assert.equal(isReportingDateConsistent('2026-10-01', 2026, 10, referenceDate), true);
});

test('serializer writes the flat query-friendly schema and permits an unknown unit', () => {
  const serialized = serializeCompletedProfileData('user-1', validInput, referenceDate);
  if (!serialized) throw new Error('Expected a valid serialized profile');
  assert.equal(serialized.firstName, 'Onur Can');
  assert.equal(serialized.militaryPeriodYear, 2026);
  assert.equal(serialized.militaryPeriodMonth, 8);
  assert.equal(serialized.militaryUnit, null);
  assert.equal('militaryPeriod' in serialized, false);
  assert.deepEqual(parseCompletedProfileData('user-1', serialized), serialized);
});

test('serializer stores canonical unit identity from the catalog and rejects a city mismatch', () => {
  const canonicalInput: CompleteUserProfileInput = {
    ...validInput,
    militaryCity: 43,
    militaryUnit: 'Eski görünen ad',
    militaryUnitId: 'air-43-hava-er-egitim-tugay-komutanligi',
    militaryUnitNameSnapshot: 'Eski görünen ad',
    forceCode: 'land',
  };
  const serialized = serializeCompletedProfileData('user-1', canonicalInput, referenceDate);
  assert.equal(serialized?.militaryUnitId, 'air-43-hava-er-egitim-tugay-komutanligi');
  assert.equal(serialized?.militaryUnitNameSnapshot, 'Hava Er Eğitim Tugay Komutanlığı');
  assert.equal(serialized?.forceCode, 'air');
  assert.equal(serializeCompletedProfileData('user-1', { ...canonicalInput, militaryCity: 6 }, referenceDate), null);
});

test('profile photos remain optional and only accept the deterministic owner path', () => {
  const serialized = serializeCompletedProfileData('user-1', validInput, referenceDate);
  assert.equal(serialized?.photoPath, null);
  assert.equal(parseCompletedProfileData('user-1', { ...serialized, photoPath: undefined })?.photoPath, null);
  assert.equal(
    parseCompletedProfileData('user-1', { ...serialized, photoPath: getProfilePhotoPath('user-1') })?.photoPath,
    'users/user-1/profile/avatar.jpg',
  );
  assert.equal(
    parseCompletedProfileData('user-1', { ...serialized, photoPath: 'users/user-2/profile/avatar.jpg' }),
    null,
  );
  assert.equal(getProfileInitials(' onur ', ' özovalı '), 'OÖ');
});

test('normal profile edits preserve the current photo path', () => {
  const existingProfile = {
    ...historicalProfile,
    photoPath: getProfilePhotoPath('user-1'),
  };
  const serialized = serializeUpdatedProfileData('user-1', {
    ...existingProfile,
    firstName: 'Onur Can',
  }, existingProfile, referenceDate);
  assert.equal(serialized?.photoPath, existingProfile.photoPath);
});

test('known unit names are normalized and length-validated', () => {
  const serialized = serializeCompletedProfileData('user-1', {
    ...validInput,
    militaryUnit: '  5. Piyade   Eğitim Tugayı  ',
  }, referenceDate);
  assert.equal(serialized?.militaryUnit, '5. Piyade Eğitim Tugayı');
  assert.equal(serializeCompletedProfileData('user-1', { ...validInput, militaryUnit: 'A' }, referenceDate), null);
});

test('legacy Phase 2C period documents parse without inventing missing values', () => {
  const legacy = parseCompletedProfileData('user-1', {
    uid: 'user-1',
    firstName: 'Onur',
    lastName: 'Özovalı',
    birthYear: 2000,
    residenceCity: 34,
    departureCity: 34,
    militaryCity: 6,
    militaryType: 'standard',
    militaryPeriod: { year: 2026, month: 8 },
    militaryUnit: '5. Piyade Eğitim Tugayı',
    reportingDate: '2026-08-08',
    onboardingCompleted: true,
  });
  assert.equal(legacy?.militaryPeriodYear, 2026);
  assert.equal(legacy?.militaryPeriodMonth, 8);
  assert.equal(legacy?.militaryUnit, '5. Piyade Eğitim Tugayı');

  assert.equal(parseCompletedProfileData('user-1', {
    uid: 'user-1',
    firstName: 'Onur',
    onboardingCompleted: true,
  }), null);
});

test('serializer rejects past periods and inconsistent reporting dates', () => {
  assert.equal(serializeCompletedProfileData('user-1', {
    ...validInput,
    militaryPeriodMonth: 7,
  }, referenceDate), null);
  assert.equal(serializeCompletedProfileData('user-1', {
    ...validInput,
    militaryPeriodMonth: 10,
    reportingDate: '2026-09-30',
  }, referenceDate), null);
});
