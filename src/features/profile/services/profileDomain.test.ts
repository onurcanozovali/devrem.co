/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { turkeyProvinces } from '@/data/turkeyProvinces';
import { createMilitaryMonthOptions, createMilitaryYearOptions } from '../profileOptions';
import type { CompleteUserProfileInput } from '../types/profile';
import { parseCompletedProfileData, serializeCompletedProfileData } from './profileSerialization';
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
