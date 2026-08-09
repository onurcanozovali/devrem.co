/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDiscoveryNotificationCopy,
  decideMembershipTransition,
  getDeliveryReservationDecision,
  getDiscoveryNotificationReason,
  getMembershipFingerprint,
  getUtcDayBucket,
  hasExactDevreIdentity,
  type NotificationPreferences,
  type NotificationProfile,
} from '../src/discoveryNotificationDomain';

const enabledPreferences: NotificationPreferences = {
  enabled: true,
  discovery: {
    newDevre: true,
    sameResidenceCity: true,
    sameDepartureCity: true,
  },
};

function profile(overrides: Partial<NotificationProfile> = {}): NotificationProfile {
  return {
    userId: 'user-1',
    firstName: 'Ahmet',
    residenceCity: 55,
    departureCity: 6,
    militaryCity: 43,
    militaryPeriodYear: 2026,
    militaryPeriodMonth: 8,
    militaryType: 'paid',
    militaryUnitId: null,
    militaryUnitName: '1. Piyade Tugayı',
    photoPath: null,
    ...overrides,
  };
}

test('exact Devre identity requires period, city, unit, and military type', () => {
  const reference = profile();
  assert.equal(hasExactDevreIdentity(reference, profile({ userId: 'user-2' })), true);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryPeriodMonth: 9 })), false);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryCity: 16 })), false);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryUnitName: 'Başka Birlik' })), false);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryType: 'standard' })), false);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryType: undefined as never })), false);
});

test('canonical unit IDs take precedence over matching display names', () => {
  const reference = profile({ militaryUnitId: 'unit-1' });
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryUnitId: 'unit-1' })), true);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryUnitId: 'unit-2' })), false);
  assert.equal(hasExactDevreIdentity(reference, profile({ militaryUnitId: null })), false);
  assert.equal(getMembershipFingerprint(profile({ militaryUnitName: null })), null);
});

test('strongest enabled notification reason is selected exactly once', () => {
  const joining = profile();
  const recipient = profile({ userId: 'recipient' });
  assert.equal(getDiscoveryNotificationReason(joining, recipient, enabledPreferences), 'sameDepartureCity');
  assert.equal(getDiscoveryNotificationReason(joining, recipient, {
    ...enabledPreferences,
    discovery: { ...enabledPreferences.discovery, sameDepartureCity: false },
  }), 'sameResidenceCity');
  assert.equal(getDiscoveryNotificationReason(joining, recipient, {
    ...enabledPreferences,
    discovery: { newDevre: true, sameDepartureCity: false, sameResidenceCity: false },
  }), 'newDevre');
});

test('master or all applicable child preferences off means no notification', () => {
  const joining = profile();
  const recipient = profile({ userId: 'recipient' });
  assert.equal(getDiscoveryNotificationReason(joining, recipient, {
    ...enabledPreferences,
    enabled: false,
  }), null);
  assert.equal(getDiscoveryNotificationReason(joining, recipient, {
    enabled: true,
    discovery: { newDevre: false, sameDepartureCity: false, sameResidenceCity: false },
  }), null);
});

test('secondary city signals never include a non-Devre recipient', () => {
  const joining = profile();
  assert.equal(getDiscoveryNotificationReason(
    joining,
    profile({ userId: 'recipient', militaryType: 'standard' }),
    enabledPreferences,
  ), null);
});

test('membership transitions notify only genuine live entries', () => {
  const fingerprint = getMembershipFingerprint(profile());
  assert.ok(fingerprint);
  const liveJoin = decideMembershipTransition({
    beforeFingerprint: null,
    nextFingerprint: fingerprint,
    previousState: null,
    notificationsEnabled: true,
    sourceEventId: 'event-1',
    source: 'live',
  });
  assert.equal(liveJoin.shouldNotify, true);
  assert.equal(liveJoin.nextState.version, 1);
  assert.equal(decideMembershipTransition({
    beforeFingerprint: fingerprint,
    nextFingerprint: fingerprint,
    previousState: null,
    notificationsEnabled: true,
    sourceEventId: null,
    source: 'baseline',
  }).shouldNotify, false);
  assert.equal(decideMembershipTransition({
    beforeFingerprint: null,
    nextFingerprint: fingerprint,
    previousState: null,
    notificationsEnabled: true,
    sourceEventId: null,
    source: 'development-seed',
  }).shouldNotify, false);
});

test('profile edits within the same membership do not notify again', () => {
  const fingerprint = getMembershipFingerprint(profile());
  const transition = decideMembershipTransition({
    beforeFingerprint: fingerprint,
    nextFingerprint: fingerprint,
    previousState: { active: true, fingerprint, lastJoinEventId: 'event-1', version: 2 },
    notificationsEnabled: true,
    sourceEventId: 'event-2',
    source: 'live',
  });
  assert.equal(transition.shouldNotify, false);
  assert.equal(transition.nextState.version, 2);
});

test('a retry of the same live join resumes recipient processing at the same version', () => {
  const fingerprint = getMembershipFingerprint(profile());
  const transition = decideMembershipTransition({
    beforeFingerprint: null,
    nextFingerprint: fingerprint,
    previousState: {
      active: true,
      fingerprint,
      lastJoinEventId: 'event-1',
      version: 3,
    },
    notificationsEnabled: true,
    sourceEventId: 'event-1',
    source: 'live',
  });
  assert.equal(transition.shouldNotify, true);
  assert.equal(transition.nextState.version, 3);
  assert.equal(decideMembershipTransition({
    ...transition,
    beforeFingerprint: fingerprint,
    nextFingerprint: fingerprint,
    previousState: transition.nextState,
    notificationsEnabled: true,
    sourceEventId: 'event-2',
    source: 'live',
  }).shouldNotify, false);
});

test('delivery reservation is idempotent and enforces three sends per UTC day', () => {
  assert.equal(getDeliveryReservationDecision({ currentDailyCount: 0, deliveryAlreadyExists: true }), 'duplicate');
  assert.equal(getDeliveryReservationDecision({ currentDailyCount: 2, deliveryAlreadyExists: false }), 'send');
  assert.equal(getDeliveryReservationDecision({ currentDailyCount: 3, deliveryAlreadyExists: false }), 'rate-limited');
  assert.equal(getUtcDayBucket(new Date('2026-08-10T23:59:59.000Z')), '20260810');
});

test('notification copy contains no identifiers or private military metadata', () => {
  const copy = createDiscoveryNotificationCopy('sameResidenceCity', ' Ahmet ');
  assert.deepEqual(copy, {
    title: 'Şehrinden yeni bir devren var 👋',
    body: 'Ahmet de senin şehrinden.',
  });
  assert.equal(JSON.stringify(copy).includes('user-'), false);
});