/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import type { Firestore } from 'firebase-admin/firestore';

import { createDirectConversationId, createDirectRecipientStateUpdate, getOrCreateDirectConversation, synchronizeDirectBlockRelationship } from '../src/directMessages';

test('one user pair always resolves to one deterministic direct conversation', () => {
  assert.equal(
    createDirectConversationId('user-b', 'user-a'),
    createDirectConversationId('user-a', 'user-b'),
  );
  assert.match(createDirectConversationId('user-a', 'user-b'), /^direct-v1-[a-f0-9]{64}$/);
  assert.throws(() => createDirectConversationId('user-a', 'user-a'), /invalid-direct-participants/);
});

test('a legitimate new message resurfaces a locally hidden deterministic conversation', () => {
  assert.deepEqual(createDirectRecipientStateUpdate(4), { unreadCount: 5, hidden: false, hiddenAt: null });
});

function fakeDatabase(values: Record<string, Record<string, unknown> | null>) {
  const writes: Array<{ path: string; value: Record<string, unknown> }> = [];
  const reads: string[] = [];
  const database = {
    doc(path: string) {
      return {
        path,
        async get() {
          reads.push(path);
          const value = values[path] ?? null;
          return { exists: value !== null, get: (field: string) => value?.[field], data: () => value };
        },
        async set(value: Record<string, unknown>) { writes.push({ path, value }); },
      };
    },
    async getAll(...references: Array<{ get(): Promise<unknown> }>) {
      return Promise.all(references.map((reference) => reference.get()));
    },
    batch() {
      return {
        set(reference: { path: string }, value: Record<string, unknown>) { writes.push({ path: reference.path, value }); },
        async commit() { return undefined; },
      };
    },
  } as unknown as Firestore;
  return { database, reads, writes };
}

test('new direct conversation respects recipient privacy and two-way blocks', async () => {
  const disabled = fakeDatabase({
    'publicProfiles/user-b': { firstName: 'B' },
    'users/user-b/communicationPreferences/main': { allowDirectMessages: false },
  });
  await assert.rejects(() => getOrCreateDirectConversation(disabled.database, 'user-a', 'user-b'), /direct-messages-disabled/);
  assert.equal(disabled.writes.length, 0);

  const blocked = fakeDatabase({
    'publicProfiles/user-b': { firstName: 'B' },
    'users/user-b/blockedUsers/user-a': { blockedUid: 'user-a' },
  });
  await assert.rejects(() => getOrCreateDirectConversation(blocked.database, 'user-a', 'user-b'), /direct-message-blocked/);
  assert.equal(blocked.writes.length, 0);
});

test('existing direct conversation is reused when recipient later disables new DMs', async () => {
  const conversationId = createDirectConversationId('user-a', 'user-b');
  const existing = fakeDatabase({
    'publicProfiles/user-b': { firstName: 'B' },
    'users/user-b/communicationPreferences/main': { allowDirectMessages: false },
    [`directConversations/${conversationId}`]: { conversationId, participantUids: ['user-a', 'user-b'] },
    [`directConversations/${conversationId}/participantStates/user-a`]: { uid: 'user-a', hidden: false },
  });
  assert.equal(await getOrCreateDirectConversation(existing.database, 'user-a', 'user-b'), conversationId);
  assert.equal(existing.writes.length, 0);
  assert.equal(existing.reads.includes('users/user-b/communicationPreferences/main'), false);
});

test('existing conversation fast path reports reuse without creation-only privacy lookup', async () => {
  const conversationId = createDirectConversationId('user-a', 'user-b');
  const existing = fakeDatabase({
    'publicProfiles/user-b': { firstName: 'B' },
    [`directConversations/${conversationId}`]: { conversationId, participantUids: ['user-a', 'user-b'] },
    [`directConversations/${conversationId}/participantStates/user-a`]: { uid: 'user-a', hidden: false },
  });
  let outcome = '';
  const phases: string[] = [];
  assert.equal(await getOrCreateDirectConversation(existing.database, 'user-a', 'user-b', {
    onOutcome: (value) => { outcome = value; },
    onPhase: (phase) => phases.push(phase),
  }), conversationId);
  assert.equal(outcome, 'reused');
  assert.deepEqual(phases, ['lookup']);
});

test('an existing hidden conversation is unhidden without rewriting its conversation document', async () => {
  const conversationId = createDirectConversationId('user-a', 'user-b');
  const hidden = fakeDatabase({
    'publicProfiles/user-b': { firstName: 'B' },
    [`directConversations/${conversationId}`]: { conversationId, participantUids: ['user-a', 'user-b'] },
    [`directConversations/${conversationId}/participantStates/user-a`]: { uid: 'user-a', hidden: true },
  });
  assert.equal(await getOrCreateDirectConversation(hidden.database, 'user-a', 'user-b'), conversationId);
  assert.deepEqual(hidden.writes.map(({ path, value }) => [path, value.hidden]), [
    [`directConversations/${conversationId}/participantStates/user-a`, false],
  ]);
});

test('block synchronization locks both participants and reverse block keeps the same thread locked', async () => {
  const conversationId = createDirectConversationId('user-a', 'user-b');
  const blocked = fakeDatabase({
    [`directConversations/${conversationId}`]: { conversationId },
    'users/user-a/blockedUsers/user-b': { blockedUid: 'user-b' },
  });
  await synchronizeDirectBlockRelationship(blocked.database, 'user-a', 'user-b');
  assert.deepEqual(blocked.writes.map(({ path, value }) => [path, value.messagingAllowed]), [
    [`directConversations/${conversationId}/participantStates/user-a`, false],
    [`directConversations/${conversationId}/participantStates/user-b`, false],
  ]);

  const reverseStillExists = fakeDatabase({
    [`directConversations/${conversationId}`]: { conversationId },
    'users/user-b/blockedUsers/user-a': { blockedUid: 'user-a' },
  });
  await synchronizeDirectBlockRelationship(reverseStillExists.database, 'user-a', 'user-b');
  assert.equal(reverseStillExists.writes.every(({ value }) => value.messagingAllowed === false), true);

  const unblocked = fakeDatabase({ [`directConversations/${conversationId}`]: { conversationId } });
  await synchronizeDirectBlockRelationship(unblocked.database, 'user-a', 'user-b');
  assert.equal(unblocked.writes.every(({ value }) => value.messagingAllowed === true), true);
});
