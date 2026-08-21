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
  getPublicProfileDisplayName,
  matchesDiscoveryNameSearch,
  parsePublicProfileData,
} from './discoveryDomain';
import {
  DISCOVERY_PAGE_SIZE,
  appendUniqueDiscoveryPage,
  canLoadNextDiscoveryPage,
  createDiscoveryPageRequest,
  excludeBlockedDiscoveryProfiles,
  getDiscoveryQueryKey,
  hasMoreDiscoveryPages,
  shouldResetDiscoveryPagination,
} from './discoveryPagination';

const reference = {
  userId: 'current-user',
  residenceCity: 55 as const,
  departureCity: 6 as const,
  militaryCity: 34 as const,
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryType: 'standard' as const,
  militaryUnitId: null,
  militaryUnitName: '1. Piyade Tugayı',
  forceCode: null,
};

function createProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    userId: 'candidate-1',
    firstName: 'Mehmet',
    lastName: 'Yılmaz',
    residenceCity: 35,
    departureCity: 35,
    militaryCity: 34,
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
    militaryType: 'standard',
    militaryUnitId: null,
    militaryUnitName: '1. Piyade Tugayı',
    photoPath: null,
    updatedAt: new Date('2026-08-09T00:00:00.000Z'),
    ...overrides,
    forceCode: overrides.forceCode ?? null,
  };
}

test('public projection accepts current and legacy discovery-safe unit fields', () => {
  const profile = createProfile();
  const { userId, ...document } = profile;
  assert.deepEqual(parsePublicProfileData(userId, document), profile);
  const {
    lastName: _lastName,
    militaryUnitId: _unitId,
    militaryUnitName,
    forceCode: _forceCode,
    ...legacyDocument
  } = document;
  assert.deepEqual(parsePublicProfileData(userId, {
    ...legacyDocument,
    militaryUnit: militaryUnitName,
  }), { ...profile, lastName: null });
  assert.equal(parsePublicProfileData(userId, { ...document, lastName: 'A' }), null);
  assert.equal(parsePublicProfileData(userId, { ...document, birthYear: 2000 }), null);
  assert.equal(parsePublicProfileData(userId, { ...document, phoneNumber: '+905000000000' }), null);
});

test('base devre pool requires the same period, city, unit, and type', () => {
  const candidates = [
    createProfile({ userId: 'current-user' }),
    createProfile({ userId: 'eligible' }),
    createProfile({ userId: 'different-type', militaryType: 'paid' }),
    createProfile({ userId: 'same-city-different-unit', militaryUnitName: 'Farklı Birlik' }),
    createProfile({ userId: 'same-city-unknown-unit', militaryUnitName: null }),
    createProfile({ userId: 'same-unit-different-city', militaryCity: 16 }),
    createProfile({ userId: 'different-period', militaryPeriodMonth: 3 }),
  ];
  assert.deepEqual(
    filterAndRankPublicProfiles(candidates, reference).map(({ userId }) => userId),
    ['eligible'],
  );
});

test('normalized unit text is a temporary fallback and missing units never match', () => {
  assert.equal(getDiscoveryRelevanceScore(
    reference,
    createProfile({ militaryUnitName: ' 1.   PİYADE tugayı ' }),
  ), 0);
  assert.equal(getDiscoveryRelevanceScore(
    { ...reference, militaryUnitName: null },
    createProfile({ militaryUnitName: null }),
  ), -1);
});

test('canonical unit IDs override matching display names', () => {
  const identifiedReference = { ...reference, militaryUnitId: 'unit-1' };
  assert.equal(getDiscoveryRelevanceScore(
    identifiedReference,
    createProfile({ militaryUnitId: 'unit-1', militaryUnitName: 'Başka Görünen Ad' }),
  ), 0);
  assert.equal(getDiscoveryRelevanceScore(
    identifiedReference,
    createProfile({ militaryUnitId: 'unit-2' }),
  ), -1);
  assert.equal(getDiscoveryRelevanceScore(
    identifiedReference,
    createProfile({ militaryUnitId: null }),
  ), -1);
});

test('missing or malformed military types never create exact devre membership', () => {
  assert.equal(getDiscoveryRelevanceScore(
    reference,
    createProfile({ militaryType: undefined as never }),
  ), -1);
  assert.equal(getDiscoveryRelevanceScore(
    { ...reference, militaryType: 'invalid' as never },
    createProfile(),
  ), -1);
});

test('departure and residence only affect relevance inside the exact devre pool', () => {
  assert.equal(getDiscoveryRelevanceScore(reference, createProfile({ militaryPeriodMonth: 3 })), -1);
  const profiles = filterAndRankPublicProfiles([
    createProfile({ userId: 'residence', residenceCity: 55 }),
    createProfile({ userId: 'departure', departureCity: 6 }),
    createProfile({ userId: 'other' }),
    createProfile({ userId: 'city-only', residenceCity: 55, departureCity: 6, militaryUnitName: 'Farklı Birlik' }),
    createProfile({ userId: 'departure-only', departureCity: 6, militaryType: 'paid' }),
    createProfile({ userId: 'residence-only', residenceCity: 55, militaryCity: 16 }),
  ], reference);
  assert.deepEqual(profiles.map(({ userId }) => userId), ['departure', 'residence', 'other']);
});

test('quick segments filter the eligible base group', () => {
  const profiles = [
    createProfile({ userId: 'all-signals', residenceCity: 55, departureCity: 6 }),
    createProfile({ userId: 'residence', residenceCity: 55, departureCity: 7 }),
    createProfile({ userId: 'departure', residenceCity: 35, departureCity: 6 }),
    createProfile({ userId: 'other' }),
    createProfile({ userId: 'not-devre', residenceCity: 55, departureCity: 6, militaryUnitName: 'Farklı Birlik' }),
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
  })), ['Aynı birlik', "Ankara'dan yola çıkıyor"]);
  assert.deepEqual(getMatchReasonBadges(reference, createProfile({
    residenceCity: 55,
    militaryUnitName: 'Farklı Birlik',
  })), []);
});

test('empty-state copy reflects the selected segment', () => {
  assert.equal(getDiscoveryEmptyStateCopy('all'), 'Henüz senin devre grubunda başka kimse yok.');
  assert.equal(getDiscoveryEmptyStateCopy('residence'), 'Henüz senin şehrinden bir devre bulunamadı.');
  assert.equal(getDiscoveryEmptyStateCopy('departure'), 'Henüz seninle aynı yerden yola çıkacak bir devre yok.');
});

test('display name includes a normalized surname and safely supports legacy profiles', () => {
  assert.equal(getPublicProfileDisplayName(createProfile({ firstName: '  Onurcan ', lastName: ' Özovalı  ' })), 'Onurcan Özovalı');
  assert.equal(getPublicProfileDisplayName(createProfile({ firstName: 'Onurcan', lastName: null })), 'Onurcan');
  assert.equal(matchesDiscoveryNameSearch(createProfile({ firstName: 'Onurcan', lastName: 'Özovalı' }), 'özovalı'), true);
});

test('discovery pagination uses a bounded first page and the prior cursor for page two', () => {
  assert.deepEqual(createDiscoveryPageRequest(), { cursor: null, limit: DISCOVERY_PAGE_SIZE });
  assert.deepEqual(createDiscoveryPageRequest('profile-040'), {
    cursor: 'profile-040',
    limit: DISCOVERY_PAGE_SIZE,
  });
  assert.equal(DISCOVERY_PAGE_SIZE, 40);
});

test('discovery pagination appends unique profiles without changing earlier page order', () => {
  const firstPage = [
    createProfile({ userId: 'profile-001' }),
    createProfile({ userId: 'profile-002' }),
  ];
  const pages = appendUniqueDiscoveryPage([firstPage], [
    createProfile({ userId: 'profile-002' }),
    createProfile({ userId: 'profile-003' }),
  ]);
  assert.deepEqual(pages.flatMap((page) => page.map(({ userId }) => userId)), [
    'profile-001', 'profile-002', 'profile-003',
  ]);
  assert.equal(pages[0], firstPage);
});

test('discovery pagination end and concurrency guards stop redundant requests', () => {
  assert.equal(hasMoreDiscoveryPages(DISCOVERY_PAGE_SIZE), true);
  assert.equal(hasMoreDiscoveryPages(DISCOVERY_PAGE_SIZE - 1), false);
  assert.equal(canLoadNextDiscoveryPage({ hasMore: false, isLoading: false }), false);
  assert.equal(canLoadNextDiscoveryPage({ hasMore: true, isLoading: true }), false);
  assert.equal(canLoadNextDiscoveryPage({ hasMore: true, isLoading: false }), true);
});

test('only effective Firestore query changes reset discovery pagination', () => {
  const key = getDiscoveryQueryKey(reference);
  assert.equal(shouldResetDiscoveryPagination(key, getDiscoveryQueryKey(reference)), false);
  assert.equal(shouldResetDiscoveryPagination(
    key,
    getDiscoveryQueryKey({ ...reference, militaryPeriodMonth: 3 }),
  ), true);
  // Residence/departure segments are not part of DiscoveryQuery and therefore keep this key/cursor.
});

test('blocked profiles remain excluded from every loaded discovery page', () => {
  const profiles = [
    createProfile({ userId: 'visible' }),
    createProfile({ userId: 'blocked' }),
  ];
  assert.deepEqual(
    excludeBlockedDiscoveryProfiles(profiles, new Set(['blocked'])).map(({ userId }) => userId),
    ['visible'],
  );
});
