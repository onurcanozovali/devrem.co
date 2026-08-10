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
  }), { id: 'message-1', senderUid: 'user-1', text: 'Selam devre' });
  assert.equal(parseGroupChatMessage('message-1', { id: 'wrong', senderUid: 'user-1', text: 'Selam' }), null);
  assert.equal(parseGroupChatMessage('message-1', { id: 'message-1', senderUid: '', text: 'Selam' }), null);
  assert.equal(parseGroupChatMessage('message-1', { id: 'message-1', senderUid: 'user-1', text: ' '.repeat(2) }), null);
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
  assert.deepEqual(createGroupMessageNotificationCopy('Onur', 'İlk satır\nikinci satır'), {
    title: 'Onur • Devre Grubu',
    body: 'İlk satır ikinci satır',
  });
  assert.ok(createGroupMessageNotificationCopy('', 'a'.repeat(200)).body.length <= 120);
});
