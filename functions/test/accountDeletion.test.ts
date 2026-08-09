/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteAccountData,
  getProfilePhotoPath,
  isAuthUserMissing,
  type AccountDeletionDependencies,
} from '../src/accountDeletion';

function createDependencies(calls: string[]): AccountDeletionDependencies {
  return {
    deleteAvatar: async (uid) => { calls.push(`avatar:${uid}`); },
    deleteProfile: async (uid) => { calls.push(`profile:${uid}`); },
    deleteAuthUser: async (uid) => { calls.push(`auth:${uid}`); },
    isAuthUserMissing,
  };
}

test('trusted deletion removes avatar before Firestore and Auth data', async () => {
  const calls: string[] = [];
  await deleteAccountData('user-1', createDependencies(calls));
  assert.deepEqual(calls, ['avatar:user-1', 'profile:user-1', 'auth:user-1']);
  assert.equal(getProfilePhotoPath('user-1'), 'users/user-1/profile/avatar.jpg');
});

test('avatar cleanup failure stops deletion before destructive profile changes', async () => {
  const calls: string[] = [];
  const dependencies = createDependencies(calls);
  dependencies.deleteAvatar = async () => {
    calls.push('avatar-failed');
    throw new Error('storage unavailable');
  };
  await assert.rejects(deleteAccountData('user-1', dependencies), /storage unavailable/);
  assert.deepEqual(calls, ['avatar-failed']);
});

test('an already-missing Auth user keeps retries idempotent', async () => {
  const calls: string[] = [];
  const dependencies = createDependencies(calls);
  dependencies.deleteAuthUser = async () => {
    calls.push('auth-missing');
    throw { code: 'auth/user-not-found' };
  };
  await deleteAccountData('user-1', dependencies);
  assert.deepEqual(calls, ['avatar:user-1', 'profile:user-1', 'auth-missing']);
});