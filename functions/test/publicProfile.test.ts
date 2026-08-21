/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createPublicProfileProjection } from '../src/publicProfile';

const privateProfile = {
  uid: 'user-1',
  firstName: ' Onur ',
  lastName: 'Özovalı',
  birthYear: 2000,
  residenceCity: 34,
  departureCity: 34,
  militaryCity: 6,
  militaryType: 'standard',
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryUnit: ' 1.   Piyade Tugayı ',
  reportingDate: '2027-02-10',
  photoPath: 'users/user-1/profile/avatar.jpg',
  onboardingCompleted: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

test('trusted projection contains only discovery-safe normalized fields', () => {
  const projection = createPublicProfileProjection('user-1', privateProfile);
  assert.deepEqual(projection, {
    firstName: 'Onur',
    lastName: 'Özovalı',
    residenceCity: 34,
    departureCity: 34,
    militaryCity: 6,
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
    militaryType: 'standard',
    militaryUnitId: null,
    militaryUnitName: '1. Piyade Tugayı',
    forceCode: null,
    photoPath: 'users/user-1/profile/avatar.jpg',
  });
  assert.equal(projection?.lastName, 'Özovalı');
  assert.equal('birthYear' in (projection ?? {}), false);
  assert.equal('uid' in (projection ?? {}), false);
});

test('incomplete or invalid private profiles are not projected', () => {
  assert.equal(createPublicProfileProjection('user-1', { ...privateProfile, onboardingCompleted: false }), null);
  assert.equal(createPublicProfileProjection('user-1', { ...privateProfile, residenceCity: 0 }), null);
  assert.equal(createPublicProfileProjection('user-1', { ...privateProfile, militaryType: null }), null);
  assert.equal(createPublicProfileProjection('user-1', { ...privateProfile, militaryType: 'Bedelli' }), null);
  assert.equal(createPublicProfileProjection('user-1', {
    ...privateProfile,
    photoPath: 'users/user-2/profile/avatar.jpg',
  }), null);
});

test('private legal acceptance data is never copied to the public profile', () => {
  const projection = createPublicProfileProjection('user-1', {
    ...privateProfile,
    legal: {
      termsAcceptedVersion: '2026-08-20-v1',
      privacyNoticeAcknowledgedVersion: '2026-08-20-v1',
    },
  });
  assert.equal('legal' in (projection ?? {}), false);
  assert.equal('termsAcceptedVersion' in (projection ?? {}), false);
});

test('trusted projection preserves canonical unit identity and force branding', () => {
  assert.deepEqual(createPublicProfileProjection('user-1', {
    ...privateProfile,
    militaryUnitId: 'air-43-hava-er-egitim-tugay-komutanligi',
    militaryUnitNameSnapshot: 'Hava Er Eğitim Tugay Komutanlığı',
    forceCode: 'air',
  }), {
    firstName: 'Onur',
    lastName: 'Özovalı',
    residenceCity: 34,
    departureCity: 34,
    militaryCity: 6,
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
    militaryType: 'standard',
    militaryUnitId: 'air-43-hava-er-egitim-tugay-komutanligi',
    militaryUnitName: 'Hava Er Eğitim Tugay Komutanlığı',
    forceCode: 'air',
    photoPath: 'users/user-1/profile/avatar.jpg',
  });
});
