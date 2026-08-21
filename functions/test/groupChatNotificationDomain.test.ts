/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allowsGroupMessageNotifications,
  createGroupMessageDeliveryId,
  createGroupMessageNotificationCopy,
  parseGroupChatMessage,
  selectGroupMessageRecipients,
} from '../src/groupChatNotificationDomain';

test('message parsing accepts bounded text and rejects malformed events permanently', () => {
  assert.deepEqual(parseGroupChatMessage('message-1', {
    id: 'message-1',
    senderUid: 'user-1',
    text: '  Selam devre  ',
  }), { id: 'message-1', senderUid: 'user-1', type: 'text', text: 'Selam devre', mediaPath: null, fileName: null });
  assert.equal(parseGroupChatMessage('message-1', { id: 'wrong', senderUid: 'user-1', text: 'Selam' }), null);
  assert.equal(parseGroupChatMessage('message-1', { id: 'message-1', senderUid: '', text: 'Selam' }), null);
  assert.equal(parseGroupChatMessage('message-1', { id: 'message-1', senderUid: 'user-1', text: ' '.repeat(2) }), null);
  assert.equal(parseGroupChatMessage('message-1', { id: 'message-1', senderUid: 'user-1', text: 'Selam', replyToMessageId: 'message-1' }), null);
  assert.equal(parseGroupChatMessage('message-1', { id: 'message-1', senderUid: 'user-1', text: 'Selam', replyToMessageId: 42 }), null);
  assert.deepEqual(parseGroupChatMessage('image-1', {
    id: 'image-1', senderUid: 'user-1', type: 'image', mediaPath: 'image.jpg', caption: '', width: 1600, height: 900,
  }), { id: 'image-1', senderUid: 'user-1', type: 'image', text: null, mediaPath: 'image.jpg', fileName: null });
  assert.equal(parseGroupChatMessage('image-1', {
    id: 'image-1', senderUid: 'user-1', type: 'image', mediaPath: 'image.jpg', caption: '', width: 1601, height: 900,
  }), null);
  assert.deepEqual(parseGroupChatMessage('audio-1', {
    id: 'audio-1', senderUid: 'user-1', type: 'audio', mediaPath: 'audio.m4a', durationMillis: 180000,
  }), { id: 'audio-1', senderUid: 'user-1', type: 'audio', text: null, mediaPath: 'audio.m4a', fileName: null });
  assert.equal(parseGroupChatMessage('audio-1', {
    id: 'audio-1', senderUid: 'user-1', type: 'audio', mediaPath: 'audio.m4a', durationMillis: 180001,
  }), null);
  assert.deepEqual(parseGroupChatMessage('document-1', {
    id: 'document-1', senderUid: 'user-1', type: 'document', mediaPath: 'document',
    fileName: 'Sevk.pdf', mimeType: 'application/pdf', extension: 'pdf', sizeBytes: 2048,
  }), { id: 'document-1', senderUid: 'user-1', type: 'document', text: null, mediaPath: 'document', fileName: 'Sevk.pdf' });
});

test('delivery id is deterministic per message and recipient', () => {
  const first = createGroupMessageDeliveryId('group-1', 'message-1', 'user-2');
  assert.equal(first, createGroupMessageDeliveryId('group-1', 'message-1', 'user-2'));
  assert.notEqual(first, createGroupMessageDeliveryId('group-1', 'message-1', 'user-3'));
  assert.notEqual(first, createGroupMessageDeliveryId('group-1', 'message-2', 'user-2'));
});

test('recipient selection excludes sender and preferences honor master override', () => {
  assert.deepEqual(selectGroupMessageRecipients(['user-1', 'user-2', 'user-2'], 'user-1'), ['user-2']);
  assert.equal(allowsGroupMessageNotifications({ enabled: false, groupMessagesEnabled: true }), false);
  assert.equal(allowsGroupMessageNotifications({ enabled: true, groupMessagesEnabled: false }), false);
  assert.equal(allowsGroupMessageNotifications({ enabled: true, groupMessagesEnabled: true }), true);
  assert.equal(allowsGroupMessageNotifications({ enabled: true }), true);
});

test('notification copy is safe and truncates long multiline text', () => {
  assert.deepEqual(createGroupMessageNotificationCopy('Onur', {
    id: 'message-1', senderUid: 'user-1', type: 'text', text: 'İlk satır\nikinci satır', mediaPath: null, fileName: null,
  }), {
    title: 'Onur • Devre Grubu',
    body: 'İlk satır ikinci satır',
  });
  assert.ok(createGroupMessageNotificationCopy('', {
    id: 'message-2', senderUid: 'user-1', type: 'text', text: 'a'.repeat(200), mediaPath: null, fileName: null,
  }).body.length <= 120);
  assert.equal(createGroupMessageNotificationCopy('Onur', {
    id: 'message-3', senderUid: 'user-1', type: 'image', text: null, mediaPath: 'image.jpg', fileName: null,
  }).body, '📷 Fotoğraf');
  assert.equal(createGroupMessageNotificationCopy('Onur', {
    id: 'message-4', senderUid: 'user-1', type: 'text', text: 'Selam', mediaPath: null, fileName: null,
  }, 'Yol Arkadaşları').title, 'Onur • Yol Arkadaşları');
  assert.equal(createGroupMessageNotificationCopy('Onur', {
    id: 'message-4', senderUid: 'user-1', type: 'audio', text: null, mediaPath: 'audio.m4a', fileName: null,
  }).body, '🎤 Sesli mesaj');
  assert.equal(createGroupMessageNotificationCopy('Onur', {
    id: 'message-5', senderUid: 'user-1', type: 'document', text: null, mediaPath: 'document', fileName: 'Sevk.pdf',
  }).body, '📄 Sevk.pdf');
});
