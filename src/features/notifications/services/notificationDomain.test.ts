/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
  parseNotificationTarget,
} from './notificationDomain';

test('notification preferences accept only the reusable discovery schema', () => {
  assert.deepEqual(parseNotificationPreferences({
    enabled: true,
    discovery: {
      newDevre: true,
      sameResidenceCity: false,
      sameDepartureCity: true,
    },
  }), {
    enabled: true,
    discovery: {
      newDevre: true,
      sameResidenceCity: false,
      sameDepartureCity: true,
    },
  });
  assert.equal(parseNotificationPreferences({ enabled: true, discovery: { newDevre: true } }), null);
  assert.equal(defaultNotificationPreferences.enabled, false);
});

test('deep-link payloads accept only semantic discovery profile targets', () => {
  assert.deepEqual(parseNotificationTarget({
    type: 'discovery.newDevre',
    target: 'profile',
    profileUserId: 'user-2',
    eventId: 'event-1',
  }), { profileUserId: 'user-2', eventId: 'event-1' });
  assert.equal(parseNotificationTarget({
    type: 'chat.message',
    target: 'profile',
    profileUserId: 'user-2',
    eventId: 'event-1',
  }), null);
  assert.equal(parseNotificationTarget({
    type: 'discovery.newDevre',
    target: '../private',
    profileUserId: 'user-2',
    eventId: 'event-1',
  }), null);
});