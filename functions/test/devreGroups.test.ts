/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { getDevreIdentityKey, hasExactDevreIdentity } from '@devrem/devre-domain';
import { createDevreGroupId, decideDevreGroupMembershipTransition } from '../src/devreGroups';
import { backfillDevreGroups } from '../src/devreGroupBackfill';
import type { PublicProfileProjection } from '../src/publicProfile';
import type { Firestore } from 'firebase-admin/firestore';

const profile: PublicProfileProjection = {
  firstName: 'Onur',
  residenceCity: 34,
  departureCity: 34,
  militaryCity: 43,
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryType: 'standard',
  militaryUnitId: null,
  militaryUnitName: '1. Piyade Tugayı',
  photoPath: null,
};

test('exact Devre identity deterministically resolves to one group', () => {
  assert.equal(createDevreGroupId(profile), createDevreGroupId({ ...profile }));
  assert.equal(hasExactDevreIdentity(profile, { ...profile, residenceCity: 6, departureCity: 35 }), true);
  assert.equal(getDevreIdentityKey(profile), getDevreIdentityKey({ ...profile, militaryUnitName: ' 1.  PİYADE TUGAYI ' }));
});

test('every canonical identity field changes the group', () => {
  const groupId = createDevreGroupId(profile);
  for (const changed of [
    { ...profile, militaryPeriodYear: 2028 },
    { ...profile, militaryPeriodMonth: 3 },
    { ...profile, militaryCity: 44 },
    { ...profile, militaryType: 'paid' as const },
    { ...profile, militaryUnitName: '2. Piyade Tugayı' },
  ]) assert.notEqual(createDevreGroupId(changed), groupId);
  assert.equal(createDevreGroupId({ ...profile, militaryUnitName: null }), null);
});

test('membership transition is retry-safe and migrates or removes stale membership', () => {
  assert.deepEqual(decideDevreGroupMembershipTransition(null, 'group-a'), { ensureGroupId: 'group-a', removeGroupId: null });
  assert.deepEqual(decideDevreGroupMembershipTransition('group-a', 'group-a'), { ensureGroupId: 'group-a', removeGroupId: null });
  assert.deepEqual(decideDevreGroupMembershipTransition('group-a', 'group-b'), { ensureGroupId: 'group-b', removeGroupId: 'group-a' });
  assert.deepEqual(decideDevreGroupMembershipTransition('group-a', null), { ensureGroupId: null, removeGroupId: 'group-a' });
});

test('group backfill is rerunnable, includes seeds safely, and has no notification dependency', async () => {
  const documents = [{ id: 'real-user' }, { id: 'seed-user' }];
  const query = {
    orderBy: () => query,
    limit: () => query,
    startAfter: () => query,
    get: async () => ({ docs: documents, empty: false, size: documents.length }),
  };
  const database = {
    doc: () => ({ get: async () => ({ exists: true, get: () => ['seed-user'] }) }),
    collection: () => query,
  } as unknown as Firestore;
  const calls: string[] = [];
  const synchronize = async (_database: Firestore, uid: string, source: string) => {
    calls.push(`${uid}:${source}`);
    return `group-${uid}`;
  };
  assert.equal(await backfillDevreGroups(database, synchronize), 2);
  assert.equal(await backfillDevreGroups(database, synchronize), 2);
  assert.deepEqual(calls, [
    'real-user:backfill',
    'seed-user:development-seed',
    'real-user:backfill',
    'seed-user:development-seed',
  ]);
});
