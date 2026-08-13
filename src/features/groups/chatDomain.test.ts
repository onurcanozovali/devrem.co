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

function scaledMessage(index: number): DevreChatMessage {
  const base = {
    ...message(`message-${index}`, index * 75),
    senderUid: `sender-${index % 7}`,
  };
  if (index % 4 === 1) return {
    ...base, type: 'image', caption: `Fotoğraf ${index}`, mediaPath: `image-${index}.jpg`, width: 1200, height: 800,
  };
  if (index % 4 === 2) return {
    ...base, type: 'document', extension: 'pdf', fileName: `belge-${index}.pdf`, mediaPath: `document-${index}`,
    mimeType: 'application/pdf', sizeBytes: 1024 + index,
  };
  if (index % 4 === 3) return {
    ...base, type: 'audio', durationMillis: 30_000 + index, mediaPath: `audio-${index}.m4a`,
  };
  return base;
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

test('unchanged realtime snapshots preserve message object identity for memoized rows', () => {
  const current = Array.from({ length: 500 }, (_, index) => scaledMessage(index));
  const repeatedSnapshot = current.slice(0, 40).map((item) => ({
    ...item,
    createdAt: item.createdAt ? new Date(item.createdAt) : null,
    clientCreatedAt: new Date(item.clientCreatedAt),
  }));
  const merged = mergeDevreChatMessages(current, repeatedSnapshot);
  const byId = new Map(merged.map((item) => [item.id, item]));
  current.forEach((item) => assert.equal(byId.get(item.id), item));
  assert.equal(merged.length, 500);
});

test('200-message mixed history paginates without duplicates or reordering', () => {
  const history = Array.from({ length: 200 }, (_, index) => {
    const item = scaledMessage(index);
    return index % 11 === 0 ? { ...item, deletedForEveryone: true } : item;
  });
  const firstPage = history.slice(160).reverse();
  const secondPage = history.slice(120, 160).reverse();
  const thirdPage = history.slice(80, 120).reverse();
  const fourthPage = history.slice(40, 80).reverse();
  const fifthPage = history.slice(0, 40).reverse();
  const merged = [secondPage, thirdPage, fourthPage, fifthPage]
    .reduce((current, page) => mergeDevreChatMessages(current, page), firstPage);

  assert.equal(merged.length, 200);
  assert.equal(new Set(merged.map((item) => item.id)).size, 200);
  assert.equal(merged[0]?.id, 'message-199');
  assert.equal(merged.at(-1)?.id, 'message-0');
  assert.equal(merged.filter((item) => item.deletedForEveryone).length, 19);
});

test('deterministic 20-message realtime burst stays ordered and duplicate-free', () => {
  const burst = Array.from({ length: 20 }, (_, index) => scaledMessage(1_000 + index));
  const repeated = burst.map((item) => ({ ...item }));
  const merged = mergeDevreChatMessages(mergeDevreChatMessages([], burst), repeated);

  assert.equal(merged.length, 20);
  assert.equal(new Set(merged.map((item) => item.id)).size, 20);
  assert.deepEqual(merged.map((item) => item.id), burst.toReversed().map((item) => item.id));
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
