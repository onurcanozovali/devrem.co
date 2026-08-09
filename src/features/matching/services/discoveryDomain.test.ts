/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { PublicProfile } from '../types/discovery';
import {
  filterPublicProfilesBySegment,
  filterAndRankPublicProfiles,
  getDiscoveryEmptyStateCopy,
  getDiscoveryRelevanceScore,
  getDiscoverySegmentOptions,
  getMatchReasonBadges,
  parsePublicProfileData,
} from './discoveryDomain';

const reference = {
  userId: 'current-user',
  residenceCity: 55 as const,
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
    residenceCity: 35,
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

test('base discovery requires the same period and destination and excludes the current user', () => {
  const candidates = [
    createProfile({ userId: 'current-user' }),
    createProfile({ userId: 'eligible' }),
    createProfile({ userId: 'different-destination', militaryCity: 16 }),
    createProfile({ userId: 'different-period', militaryPeriodMonth: 3 }),
  ];
  assert.deepEqual(
    filterAndRankPublicProfiles(candidates, reference).map(({ userId }) => userId),
    ['eligible'],
  );
});

test('same unit ranks above same departure, which ranks above residence-only', () => {
  assert.equal(getDiscoveryRelevanceScore(reference, createProfile({ militaryPeriodMonth: 3 })), -1);
  const profiles = filterAndRankPublicProfiles([
    createProfile({ userId: 'residence', residenceCity: 55 }),
    createProfile({ userId: 'departure', departureCity: 6 }),
    createProfile({ userId: 'unit', militaryUnit: ' 1.   PİYADE tugayı ' }),
    createProfile({ userId: 'other' }),
  ], reference);
  assert.deepEqual(profiles.map(({ userId }) => userId), ['unit', 'departure', 'residence', 'other']);
});

test('a missing unit never creates a unit match', () => {
  assert.equal(getDiscoveryRelevanceScore(
    { ...reference, militaryUnit: null },
    createProfile({ militaryUnit: null }),
  ), 0);
});

test('quick segments filter the eligible base group', () => {
  const profiles = [
    createProfile({ userId: 'all-signals', residenceCity: 55, departureCity: 6 }),
    createProfile({ userId: 'residence', residenceCity: 55, departureCity: 7 }),
    createProfile({ userId: 'departure', residenceCity: 35, departureCity: 6 }),
    createProfile({ userId: 'other' }),
  ];
  assert.deepEqual(filterPublicProfilesBySegment(profiles, reference, 'all').map(({ userId }) => userId), [
    'all-signals', 'residence', 'departure', 'other',
  ]);
  assert.deepEqual(filterPublicProfilesBySegment(profiles, reference, 'residence').map(({ userId }) => userId), [
    'all-signals', 'residence',
  ]);
  assert.deepEqual(filterPublicProfilesBySegment(profiles, reference, 'departure').map(({ userId }) => userId), [
    'all-signals', 'departure',
  ]);
});

test('duplicate city segments are removed when residence and departure are identical', () => {
  assert.deepEqual(getDiscoverySegmentOptions(reference).map(({ id }) => id), ['all', 'residence', 'departure']);
  assert.deepEqual(getDiscoverySegmentOptions({ ...reference, departureCity: 55 }).map(({ id }) => id), [
    'all', 'residence',
  ]);
});

test('match reasons are contextual, ordered, and limited to two', () => {
  assert.deepEqual(getMatchReasonBadges(reference, createProfile({
    residenceCity: 55,
    departureCity: 6,
    militaryUnit: '1. Piyade Tugayı',
  })), ['Aynı birlik', "Ankara'dan yola çıkıyor"]);
  assert.deepEqual(getMatchReasonBadges(reference, createProfile({ residenceCity: 55 })), ['Aynı şehirden']);
});

test('empty-state copy reflects the selected segment', () => {
  assert.equal(getDiscoveryEmptyStateCopy('all'), 'Henüz senin devre grubunda başka kimse yok.');
  assert.equal(getDiscoveryEmptyStateCopy('residence'), 'Henüz senin şehrinden bir devre bulunamadı.');
  assert.equal(getDiscoveryEmptyStateCopy('departure'), 'Henüz seninle aynı şehirden yola çıkacak biri yok.');
});