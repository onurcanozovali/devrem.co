/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { PublicProfile } from '../types/discovery';
import {
  filterAndRankPublicProfiles,
  getDiscoveryRelevanceScore,
  isDiscoveryPeriodSelectable,
  parsePublicProfileData,
} from './discoveryDomain';

const reference = {
  userId: 'current-user',
  departureCity: 6 as const,
  militaryCity: 34 as const,
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryUnit: '1. Piyade Tugayı',
};

function createProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    userId: 'candidate-1',
    firstName: 'Mehmet',
    departureCity: 35,
    militaryCity: 34,
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
    militaryType: 'standard',
    militaryUnit: null,
    photoPath: null,
    updatedAt: new Date('2026-08-09T00:00:00.000Z'),
    ...overrides,
  };
}

test('public projection accepts only discovery-safe fields', () => {
  const profile = createProfile();
  const { userId, ...document } = profile;
  assert.deepEqual(parsePublicProfileData(userId, document), profile);
  assert.equal(parsePublicProfileData(userId, { ...document, lastName: 'Yılmaz' }), null);
  assert.equal(parsePublicProfileData(userId, { ...document, birthYear: 2000 }), null);
  assert.equal(parsePublicProfileData(userId, { ...document, phoneNumber: '+905000000000' }), null);
});

test('relevance requires the same period and favors destination, known unit, then departure', () => {
  assert.equal(getDiscoveryRelevanceScore(reference, createProfile({ militaryPeriodMonth: 3 })), -1);
  assert.equal(getDiscoveryRelevanceScore(reference, createProfile()), 100);
  assert.equal(getDiscoveryRelevanceScore(reference, createProfile({
    departureCity: 6,
    militaryUnit: ' 1.   PİYADE tugayı ',
  })), 190);
});

test('a missing unit never creates a unit match', () => {
  assert.equal(getDiscoveryRelevanceScore(
    { ...reference, militaryUnit: null },
    createProfile({ militaryUnit: null }),
  ), 100);
});

test('filtering excludes the current user and applies compact city filters', () => {
  const candidates = [
    createProfile({ userId: 'current-user' }),
    createProfile({ userId: 'same-cities', departureCity: 6 }),
    createProfile({ userId: 'other-departure', departureCity: 7 }),
    createProfile({ userId: 'other-destination', militaryCity: 16 }),
  ];
  const results = filterAndRankPublicProfiles(candidates, reference, {
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
    militaryCity: 34,
    departureCity: 6,
  });
  assert.deepEqual(results.map(({ userId }) => userId), ['same-cities']);
});

test('historical periods are selectable only for the current stored profile period', () => {
  const now = new Date(2026, 7, 9);
  const storedPeriod = { year: 2025, month: 7 };
  assert.equal(isDiscoveryPeriodSelectable(2025, 7, storedPeriod, now), true);
  assert.equal(isDiscoveryPeriodSelectable(2025, 8, storedPeriod, now), false);
  assert.equal(isDiscoveryPeriodSelectable(2026, 8, storedPeriod, now), true);
});