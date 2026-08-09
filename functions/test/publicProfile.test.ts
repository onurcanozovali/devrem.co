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
    departureCity: 34,
    militaryCity: 6,
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
    militaryType: 'standard',
    militaryUnit: '1. Piyade Tugayı',
    photoPath: 'users/user-1/profile/avatar.jpg',
  });
  assert.equal('lastName' in (projection ?? {}), false);
  assert.equal('birthYear' in (projection ?? {}), false);
  assert.equal('uid' in (projection ?? {}), false);
});

test('incomplete or invalid private profiles are not projected', () => {
  assert.equal(createPublicProfileProjection('user-1', { ...privateProfile, onboardingCompleted: false }), null);
  assert.equal(createPublicProfileProjection('user-1', {
    ...privateProfile,
    photoPath: 'users/user-2/profile/avatar.jpg',
  }), null);
});