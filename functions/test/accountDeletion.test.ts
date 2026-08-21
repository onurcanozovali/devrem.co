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
    deleteOwnedMedia: async (uid) => { calls.push(`media:${uid}`); },
    minimizeUserReferences: async (uid) => { calls.push(`references:${uid}`); },
    deleteNotificationData: async (uid) => { calls.push(`notifications:${uid}`); },
    deleteDevreGroupMembership: async (uid) => { calls.push(`group:${uid}`); },
    deletePublicProfile: async (uid) => { calls.push(`public:${uid}`); },
    deleteProfile: async (uid) => { calls.push(`profile:${uid}`); },
    deleteAuthUser: async (uid) => { calls.push(`auth:${uid}`); },
    isAuthUserMissing,
  };
}

test('trusted deletion removes avatar and public projection before private and Auth data', async () => {
  const calls: string[] = [];
  await deleteAccountData('user-1', createDependencies(calls));
  assert.deepEqual(calls, ['media:user-1', 'public:user-1', 'notifications:user-1', 'group:user-1', 'references:user-1', 'profile:user-1', 'auth:user-1']);
  assert.equal(getProfilePhotoPath('user-1'), 'users/user-1/profile/avatar.jpg');
});

test('avatar cleanup failure stops deletion before destructive profile changes', async () => {
  const calls: string[] = [];
  const dependencies = createDependencies(calls);
  dependencies.deleteOwnedMedia = async () => {
    calls.push('media-failed');
    throw new Error('storage unavailable');
  };
  await assert.rejects(deleteAccountData('user-1', dependencies), /storage unavailable/);
  assert.deepEqual(calls, ['media-failed']);
});

test('an already-missing Auth user keeps retries idempotent', async () => {
  const calls: string[] = [];
  const dependencies = createDependencies(calls);
  dependencies.deleteAuthUser = async () => {
    calls.push('auth-missing');
    throw { code: 'auth/user-not-found' };
  };
  await deleteAccountData('user-1', dependencies);
  assert.deepEqual(calls, ['media:user-1', 'public:user-1', 'notifications:user-1', 'group:user-1', 'references:user-1', 'profile:user-1', 'auth-missing']);
});
