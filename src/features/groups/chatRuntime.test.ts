import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countUnreadIncomingMessages,
  countUnseenIncomingMessageIds,
  isNearLatestOffset,
  shouldFollowLatest,
  shouldTriggerSwipeReply,
} from './chatRuntime';

test('inverted chat bottom anchor uses the actual viewport offset', () => {
  assert.equal(isNearLatestOffset(0), true);
  assert.equal(isNearLatestOffset(96), true);
  assert.equal(isNearLatestOffset(97), false);
  assert.equal(shouldFollowLatest(true), true);
  assert.equal(shouldFollowLatest(false), false);
});

test('community badges count only incoming messages after the read cursor', () => {
  const cursor = new Date('2026-08-14T10:00:00.000Z');
  assert.equal(countUnreadIncomingMessages([
    { createdAt: new Date('2026-08-14T09:59:00.000Z'), senderUid: 'other' },
    { createdAt: new Date('2026-08-14T10:01:00.000Z'), senderUid: 'me' },
    { createdAt: new Date('2026-08-14T10:02:00.000Z'), senderUid: 'other' },
    { createdAt: null, senderUid: 'other' },
  ], 'me', cursor), 1);
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

test('reply swipe always requires a right swipe regardless of message ownership', () => {
  assert.equal(shouldTriggerSwipeReply(54, false), true);
  assert.equal(shouldTriggerSwipeReply(-54, false), false);
  assert.equal(shouldTriggerSwipeReply(54, true), true);
  assert.equal(shouldTriggerSwipeReply(-54, true), false);
});
