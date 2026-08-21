import { createHash } from 'node:crypto';

import { FieldValue, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

import { createGroupMessageNotificationCopy, parseGroupChatMessage } from './groupChatNotificationDomain.js';

export function createDirectConversationId(uidA: string, uidB: string): string {
  const participants = [uidA.trim(), uidB.trim()].sort();
  if (!participants[0] || !participants[1] || participants[0] === participants[1]) {
    throw new Error('invalid-direct-participants');
  }
  return `direct-v1-${createHash('sha256').update(`${participants[0]}\u0000${participants[1]}`).digest('hex')}`;
}

export interface DirectConversationDiagnostics {
  onOutcome?: (outcome: 'created' | 'reused' | 'unhidden') => void;
  onPhase?: (phase: 'creationPreferences' | 'lookup' | 'write', durationMs: number) => void;
}

export async function synchronizeDirectBlockRelationship(database: Firestore, blockerUid: string, blockedUid: string): Promise<void> {
  if (!blockerUid || !blockedUid || blockerUid === blockedUid) return;
  const conversationId = createDirectConversationId(blockerUid, blockedUid);
  const conversationReference = database.doc(`directConversations/${conversationId}`);
  const [conversation, currentBlock, reverseBlock] = await Promise.all([
    conversationReference.get(),
    database.doc(`users/${blockerUid}/blockedUsers/${blockedUid}`).get(),
    database.doc(`users/${blockedUid}/blockedUsers/${blockerUid}`).get(),
  ]);
  if (!conversation.exists) return;
  // Always derive from current state. A delayed/retried older event must not overwrite a newer unblock.
  const messagingAllowed = !currentBlock.exists && !reverseBlock.exists;
  const batch = database.batch();
  for (const uid of [blockerUid, blockedUid]) {
    batch.set(database.doc(`directConversations/${conversationId}/participantStates/${uid}`), {
      uid, messagingAllowed, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function getOrCreateDirectConversation(
  database: Firestore,
  callerUid: string,
  recipientUid: string,
  diagnostics?: DirectConversationDiagnostics,
): Promise<string> {
  if (!callerUid || !recipientUid || callerUid === recipientUid) throw new Error('invalid-recipient');
  const conversationId = createDirectConversationId(callerUid, recipientUid);
  const participants = [callerUid, recipientUid].sort();
  const recipientReference = database.doc(`publicProfiles/${recipientUid}`);
  const callerBlockReference = database.doc(`users/${callerUid}/blockedUsers/${recipientUid}`);
  const recipientBlockReference = database.doc(`users/${recipientUid}/blockedUsers/${callerUid}`);
  const conversationReference = database.doc(`directConversations/${conversationId}`);
  const callerStateReference = database.doc(`directConversations/${conversationId}/participantStates/${callerUid}`);
  const lookupStartedAt = Date.now();
  const snapshots = await database.getAll(
    recipientReference,
    callerBlockReference,
    recipientBlockReference,
    conversationReference,
    callerStateReference,
  );
  diagnostics?.onPhase?.('lookup', Date.now() - lookupStartedAt);
  const recipient = snapshots[0];
  const callerBlock = snapshots[1];
  const recipientBlock = snapshots[2];
  const existing = snapshots[3];
  const callerState = snapshots[4];
  if (!recipient || !callerBlock || !recipientBlock || !existing || !callerState) {
    throw new Error('direct-conversation-read-failed');
  }
  if (!recipient.exists) throw new Error('recipient-not-found');
  if (callerBlock.exists || recipientBlock.exists) throw new Error('direct-message-blocked');
  if (existing.exists) {
    const existingParticipants = existing.get('participantUids');
    if (!Array.isArray(existingParticipants)
      || existingParticipants.length !== 2
      || existingParticipants[0] !== participants[0]
      || existingParticipants[1] !== participants[1]) {
      throw new Error('invalid-direct-conversation');
    }
    if (callerState.exists && callerState.get('hidden') !== true) {
      diagnostics?.onOutcome?.('reused');
      return conversationId;
    }
    const writeStartedAt = Date.now();
    await callerStateReference.set({
      uid: callerUid,
      hidden: false,
      hiddenAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    diagnostics?.onPhase?.('write', Date.now() - writeStartedAt);
    diagnostics?.onOutcome?.('unhidden');
    return conversationId;
  }
  const preferencesStartedAt = Date.now();
  const preferences = await database.doc(`users/${recipientUid}/communicationPreferences/main`).get();
  diagnostics?.onPhase?.('creationPreferences', Date.now() - preferencesStartedAt);
  if (preferences.exists && preferences.get('allowDirectMessages') === false) {
    throw new Error('direct-messages-disabled');
  }
  const batch = database.batch();
  batch.set(conversationReference, {
    conversationId,
    type: 'direct',
    participantUids: participants,
    schemaVersion: 1,
    createdAt: FieldValue.serverTimestamp(),
    lastMessageAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(callerStateReference, {
    uid: callerUid,
    hidden: false,
    hiddenAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const writeStartedAt = Date.now();
  await batch.commit();
  diagnostics?.onPhase?.('write', Date.now() - writeStartedAt);
  diagnostics?.onOutcome?.('created');
  return conversationId;
}

function isPermanentTokenError(code: string | undefined): boolean {
  return code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token'
    || code === 'messaging/invalid-argument';
}

export function createDirectRecipientStateUpdate(currentUnreadCount: unknown) {
  return {
    unreadCount: Math.max(0, Number(currentUnreadCount) || 0) + 1,
    hidden: false,
    hiddenAt: null,
  } as const;
}

async function getActiveDevices(database: Firestore, uid: string) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const snapshot = await database.collection(`users/${uid}/devices`).limit(10).get();
  return snapshot.docs.flatMap((document) => {
    const token = document.get('token');
    const lastSeenAt = document.get('lastSeenAt');
    return document.get('enabled') === true && typeof token === 'string'
      && lastSeenAt instanceof Timestamp && lastSeenAt.toMillis() >= cutoff
      ? [{ reference: document.ref, token }]
      : [];
  });
}

export async function processDirectMessage(input: {
  conversationId: string;
  database: Firestore;
  messageId: string;
  messaging: Messaging;
  value: unknown;
}): Promise<void> {
  const { conversationId, database, messageId, messaging, value } = input;
  const message = parseGroupChatMessage(messageId, value);
  if (!message) return;
  const createdAt = typeof value === 'object' && value !== null && 'createdAt' in value && value.createdAt instanceof Timestamp
    ? value.createdAt : null;
  if (!createdAt) return;
  const expectedMediaPath = message.type === 'text' ? null
    : `directConversations/${conversationId}/media/${messageId}/${message.type === 'image' ? 'image.jpg' : message.type === 'document' ? 'document' : 'audio.m4a'}`;
  if (message.mediaPath !== expectedMediaPath || message.type === 'audio') return;
  const conversationReference = database.doc(`directConversations/${conversationId}`);
  const conversation = await conversationReference.get();
  const participants = conversation.get('participantUids');
  if (!conversation.exists || !Array.isArray(participants) || participants.length !== 2 || !participants.includes(message.senderUid)) return;
  const recipientUid = participants.find((uid) => uid !== message.senderUid);
  if (typeof recipientUid !== 'string') return;
  const [sender, recipientPreferences, senderBlock, recipientBlock] = await Promise.all([
    database.doc(`publicProfiles/${message.senderUid}`).get(),
    database.doc(`users/${recipientUid}/notificationPreferences/main`).get(),
    database.doc(`users/${message.senderUid}/blockedUsers/${recipientUid}`).get(),
    database.doc(`users/${recipientUid}/blockedUsers/${message.senderUid}`).get(),
  ]);
  if (senderBlock.exists || recipientBlock.exists) return;
  const preview = message.type === 'text' ? message.text
    : message.type === 'image' ? 'Fotoğraf'
      : message.type === 'document' ? 'Belge'
        : 'Sesli mesaj';
  const recipientState = database.doc(`directConversations/${conversationId}/participantStates/${recipientUid}`);
  const processingId = createHash('sha256').update(`${conversationId}\u0000${messageId}\u0000${recipientUid}`).digest('hex');
  const processingReference = database.doc(`_directMessageProcessing/${processingId}`);
  await database.runTransaction(async (transaction) => {
    const [state, processing, currentConversation] = await Promise.all([
      transaction.get(recipientState), transaction.get(processingReference), transaction.get(conversationReference),
    ]);
    if (processing.exists) return;
    transaction.create(processingReference, {
      conversationId, messageId, recipientUid, senderUid: message.senderUid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    transaction.set(recipientState, {
      uid: recipientUid,
      ...createDirectRecipientStateUpdate(state.get('unreadCount')),
      lastCountedMessageId: messageId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const currentLastMessageAt = currentConversation.get('lastMessageAt');
    if (!(currentLastMessageAt instanceof Timestamp) || currentLastMessageAt.toMillis() <= createdAt.toMillis()) {
      transaction.set(conversationReference, {
        lastMessagePreview: preview,
        lastMessageAt: createdAt,
        lastSenderUid: message.senderUid,
        lastMessageType: message.type,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  if (recipientPreferences.get('enabled') !== true) return;
  const deliveryId = createHash('sha256').update(`${conversationId}\u0000${messageId}\u0000${recipientUid}`).digest('hex');
  const deliveryReference = database.doc(`_directMessageNotificationDeliveries/${deliveryId}`);
  try {
    await deliveryReference.create({
      deliveryId, conversationId, messageId, recipientUid, senderUid: message.senderUid,
      status: 'reserved', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  } catch { return; }
  const devices = await getActiveDevices(database, recipientUid);
  if (!devices.length) {
    await deliveryReference.update({ status: 'no-active-devices', updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  const senderName = sender.exists && typeof sender.get('firstName') === 'string' ? sender.get('firstName') as string : 'Bir Devrem kullanıcısı';
  const copy = createGroupMessageNotificationCopy(senderName, message, '');
  copy.title = senderName;
  if (message.type === 'image') copy.body = message.text || 'Fotoğraf';
  if (message.type === 'document') copy.body = 'Belge';
  const response = await messaging.sendEach(devices.map(({ token }) => ({
    token,
    notification: copy,
    data: { type: 'direct_message', target: 'directChat', conversationId, messageId, eventId: deliveryId },
    android: { priority: 'high' },
  })));
  const invalid: DocumentReference[] = [];
  response.responses.forEach((result, index) => {
    if (!result.success && isPermanentTokenError(result.error?.code) && devices[index]) invalid.push(devices[index].reference);
  });
  await Promise.all(invalid.map((reference) => reference.delete()));
  await deliveryReference.update({
    status: response.successCount ? 'sent' : 'failed',
    successfulDeviceCount: response.successCount,
    failedDeviceCount: response.failureCount,
    invalidDeviceCount: invalid.length,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteDirectNotificationDataForUser(database: Firestore, uid: string): Promise<void> {
  const references = new Map<string, DocumentReference>();
  for (const collectionName of ['_directMessageNotificationDeliveries', '_directMessageProcessing']) {
    const collection = database.collection(collectionName);
    const [recipient, sender] = await Promise.all([
      collection.where('recipientUid', '==', uid).get(),
      collection.where('senderUid', '==', uid).get(),
    ]);
    for (const snapshot of [recipient, sender]) {
      for (const document of snapshot.docs) references.set(document.ref.path, document.ref);
    }
  }
  for (let index = 0; index < references.size; index += 400) {
    const batch = database.batch();
    for (const reference of [...references.values()].slice(index, index + 400)) batch.delete(reference);
    await batch.commit();
  }
}
