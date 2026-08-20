import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countUnseenIncomingMessageIds,
  isNearLatestOffset,
  shouldFollowLatest,
} from './chatRuntime';

test('inverted chat bottom anchor uses the actual viewport offset', () => {
  assert.equal(isNearLatestOffset(0), true);
  assert.equal(isNearLatestOffset(96), true);
  assert.equal(isNearLatestOffset(97), false);
  assert.equal(shouldFollowLatest(true), true);
  assert.equal(shouldFollowLatest(false), false);
});

test('new-message affordance counts only unseen messages from other users', () => {
  const known = new Set(['known']);
  const incoming = [
    { id: 'known', senderUid: 'other' },
    { id: 'new-1', senderUid: 'other' },
    { id: 'new-2', senderUid: 'me' },
    { id: 'new-3', senderUid: 'other' },
  ];
  assert.equal(countUnseenIncomingMessageIds(known, incoming, 'me'), 2);
});
