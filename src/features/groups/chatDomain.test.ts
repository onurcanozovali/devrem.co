/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEVRE_CHAT_MESSAGE_MAX_LENGTH,
  mergeDevreChatMessages,
  normalizeDevreChatText,
  updateDevreChatMessageStatus,
  validateDevreChatText,
  type DevreChatMessage,
} from './chatDomain';

function message(
  id: string,
  seconds: number,
  status: DevreChatMessage['status'] = 'sent',
): DevreChatMessage {
  return {
    id,
    senderUid: 'sender',
    text: id,
    createdAt: new Date(seconds * 1000),
    clientCreatedAt: new Date(seconds * 1000),
    status,
  };
}

test('chat text trims outer whitespace but preserves line breaks', () => {
    assert.equal(normalizeDevreChatText('  ilk satır\nikinci satır  '), 'ilk satır\nikinci satır');
  });

test('chat text rejects empty and oversized messages', () => {
    assert.ok(validateDevreChatText('  \n '));
    assert.ok(validateDevreChatText('a'.repeat(DEVRE_CHAT_MESSAGE_MAX_LENGTH + 1)));
    assert.equal(validateDevreChatText('geçerli'), null);
  });

test('chat merge reconciles realtime and optimistic messages without duplicates', () => {
    const optimistic = message('same-id', 1, 'pending');
    const confirmed = message('same-id', 2, 'sent');

    assert.deepEqual(mergeDevreChatMessages([optimistic], [confirmed]), [confirmed]);
  });

test('chat pagination keeps newest messages first', () => {
    assert.deepEqual(
      mergeDevreChatMessages([message('new', 3)], [message('old', 1), message('mid', 2)]),
      [message('new', 3), message('mid', 2), message('old', 1)],
    );
  });

test('chat failures remain retryable with the same id', () => {
    assert.equal(
      updateDevreChatMessageStatus([message('one', 1, 'pending')], 'one', 'failed')[0]?.status,
      'failed',
    );
  });
