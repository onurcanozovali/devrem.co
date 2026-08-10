/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { getDevreIdentityKey, hasExactDevreIdentity } from '@devrem/devre-domain';

const identity = {
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryCity: 43,
  militaryType: 'standard' as const,
  militaryUnitId: null,
  militaryUnitName: '1. Piyade Tugayı',
};

test('Discovery exact match always has the same canonical Devre group identity', () => {
  const candidate = { ...identity, militaryUnitName: '  1. PİYADE   TUGAYI ' };
  assert.equal(hasExactDevreIdentity(identity, candidate), true);
  assert.equal(getDevreIdentityKey(identity), getDevreIdentityKey(candidate));
});

test('secondary residence and departure signals are outside group identity', () => {
  const identityWithSecondarySignals = { ...identity, residenceCity: 34, departureCity: 6 };
  assert.equal(getDevreIdentityKey(identityWithSecondarySignals), getDevreIdentityKey(identity));
});
