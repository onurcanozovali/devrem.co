/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { deletedGroupMessageMediaPath } from '../src/groupChatDeletion';

test('soft deletion resolves only the sender-owned deterministic media path', () => {
  const groupId = `devre-v1-${'a'.repeat(64)}`;
  const path = `devreGroups/${groupId}/media/message-1/image.jpg`;
  const before = { id: 'message-1', senderUid: 'user-1', type: 'image', mediaPath: path };
  assert.equal(deletedGroupMessageMediaPath(groupId, 'message-1', before, {
    ...before, deletedForEveryone: true, deletedBy: 'user-1',
  }), path);
  assert.equal(deletedGroupMessageMediaPath(groupId, 'message-1', before, {
    ...before, deletedForEveryone: true, deletedBy: 'user-2',
  }), null);
  assert.equal(deletedGroupMessageMediaPath(groupId, 'message-1', { ...before, mediaPath: 'forged' }, {
    ...before, mediaPath: 'forged', deletedForEveryone: true, deletedBy: 'user-1',
  }), null);
});

test('text deletion never resolves a Storage artifact', () => {
  assert.equal(deletedGroupMessageMediaPath('group', 'message', {
    senderUid: 'user-1', type: 'text', text: 'hello',
  }, {
    senderUid: 'user-1', type: 'text', text: 'hello', deletedForEveryone: true, deletedBy: 'user-1',
  }), null);
});
