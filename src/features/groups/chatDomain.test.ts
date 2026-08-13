/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEVRE_CHAT_MESSAGE_MAX_LENGTH,
  DEVRE_CHAT_MESSAGE_PREVIEW_LENGTH,
  collapseDevreChatText,
  formatChatDate,
  getDevreChatMessagePreview,
  isSameMessageCluster,
  mergeDevreChatMessages,
  normalizeDevreChatText,
  updateDevreChatMessageStatus,
  validateDevreChatText,
  shouldShowDateSeparator,
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
    type: 'text',
    text: id,
    createdAt: new Date(seconds * 1000),
    clientCreatedAt: new Date(seconds * 1000),
    status,
    deletedForEveryone: false,
    deletedAt: null,
    deletedBy: null,
    replyToMessageId: null,
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

test('long chat text has a bounded expandable preview without splitting emoji', () => {
  assert.equal(collapseDevreChatText('kısa mesaj'), null);
  const preview = collapseDevreChatText(`${'a'.repeat(DEVRE_CHAT_MESSAGE_PREVIEW_LENGTH - 1)}😀devam`);
  assert.equal(preview, `${'a'.repeat(DEVRE_CHAT_MESSAGE_PREVIEW_LENGTH - 1)}😀…`);
});

test('reply preview is safe for text, media, and deleted messages', () => {
  assert.equal(getDevreChatMessagePreview(message('Selam devre', 1)), 'Selam devre');
  assert.equal(getDevreChatMessagePreview({ ...message('deleted', 1), deletedForEveryone: true }), 'Bu mesaj silindi');
  assert.equal(getDevreChatMessagePreview({
    ...message('image', 1), type: 'image', caption: '', mediaPath: 'image.jpg', width: 800, height: 600,
  }), 'Fotoğraf');
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

test('chat merge preserves a local media URI while realtime confirms the same message', () => {
  const optimistic: DevreChatMessage = {
    id: 'image', senderUid: 'sender', type: 'image', caption: '', mediaPath: 'remote.jpg',
    width: 800, height: 600, localMediaUri: 'file:///preview.jpg', createdAt: null,
    clientCreatedAt: new Date(1000), status: 'pending',
    deletedForEveryone: false, deletedAt: null, deletedBy: null, replyToMessageId: null,
  };
  const confirmed: DevreChatMessage = { ...optimistic, localMediaUri: undefined, createdAt: new Date(2000), status: 'sent' };
  assert.equal(mergeDevreChatMessages([optimistic], [confirmed])[0]?.localMediaUri, 'file:///preview.jpg');
});

test('message clustering requires same sender and at most five minutes', () => {
  assert.equal(isSameMessageCluster(message('newer', 301), message('current', 1)), true);
  assert.equal(isSameMessageCluster(message('newer', 302), message('current', 1)), false);
  assert.equal(isSameMessageCluster({ ...message('newer', 2), senderUid: 'other' }, message('current', 1)), false);
});

test('date separators and labels handle today, yesterday, and older days', () => {
  const now = new Date(2026, 7, 10, 12);
  assert.equal(formatChatDate(new Date(2026, 7, 10), now), 'Bugün');
  assert.equal(formatChatDate(new Date(2026, 7, 9), now), 'Dün');
  assert.equal(shouldShowDateSeparator(message('older', 1), message('current', 2)), false);
  assert.equal(shouldShowDateSeparator(message('older', 1), {
    ...message('current', 2), createdAt: new Date(86_402_000), clientCreatedAt: new Date(86_402_000),
  }), true);
});
