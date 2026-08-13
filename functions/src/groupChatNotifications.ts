import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';

import {
  allowsGroupMessageNotifications,
  createGroupMessageDeliveryId,
  createGroupMessageNotificationCopy,
  parseGroupChatMessage,
  selectGroupMessageRecipients,
} from './groupChatNotificationDomain.js';

const registrationFreshnessDays = 30;
const deliveryRetentionDays = 30;
const memberLimit = 200;

interface DeviceRegistration {
  reference: DocumentReference;
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function reserveDelivery(input: {
  database: Firestore;
  groupId: string;
  messageId: string;
  recipientUid: string;
  senderUid: string;
}): Promise<string | null> {
  const { database, groupId, messageId, recipientUid, senderUid } = input;
  const deliveryId = createGroupMessageDeliveryId(groupId, messageId, recipientUid);
  const reference = database.doc(`_groupMessageNotificationDeliveries/${deliveryId}`);
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) return null;
    transaction.create(reference, {
      deliveryId,
      groupId,
      messageId,
      recipientUid,
      senderUid,
      status: 'reserved',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + deliveryRetentionDays * 24 * 60 * 60 * 1000),
    });
    return deliveryId;
  });
}

async function getFreshDevices(database: Firestore, uid: string): Promise<DeviceRegistration[]> {
  const cutoff = Date.now() - registrationFreshnessDays * 24 * 60 * 60 * 1000;
  const snapshot = await database.collection(`users/${uid}/devices`).limit(10).get();
  const stale: DocumentReference[] = [];
  const devices = snapshot.docs.flatMap((document) => {
    const token = document.get('token');
    const enabled = document.get('enabled');
    const lastSeenAt = document.get('lastSeenAt');
    if (
      enabled !== true
      || typeof token !== 'string'
      || !(lastSeenAt instanceof Timestamp)
      || lastSeenAt.toMillis() < cutoff
    ) {
      if (lastSeenAt instanceof Timestamp && lastSeenAt.toMillis() < cutoff) stale.push(document.ref);
      return [];
    }
    return [{ reference: document.ref, token }];
  });
  await Promise.all(stale.map((reference) => reference.delete()));
  return devices;
}

function isPermanentTokenError(code: string | undefined): boolean {
  return code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token'
    || code === 'messaging/invalid-argument';
}

async function notifyRecipient(input: {
  database: Firestore;
  groupId: string;
  messageId: string;
  messaging: Messaging;
  recipientUid: string;
  senderName: string;
  senderUid: string;
  message: NonNullable<ReturnType<typeof parseGroupChatMessage>>;
}): Promise<void> {
  const { database, groupId, message, messageId, messaging, recipientUid, senderName, senderUid } = input;
  const preferences = await database.doc(`users/${recipientUid}/notificationPreferences/main`).get();
  if (!preferences.exists || !allowsGroupMessageNotifications(preferences.data())) return;
  const deliveryId = await reserveDelivery({ database, groupId, messageId, recipientUid, senderUid });
  if (!deliveryId) return;
  const delivery = database.doc(`_groupMessageNotificationDeliveries/${deliveryId}`);
  const devices = await getFreshDevices(database, recipientUid);
  if (devices.length === 0) {
    await delivery.update({ status: 'no-active-devices', updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  const copy = createGroupMessageNotificationCopy(senderName, message);
  try {
    const response = await messaging.sendEach(devices.map(({ token }) => ({
      token,
      notification: copy,
      data: {
        type: 'group.message',
        target: 'groupChat',
        groupId,
        messageId,
        eventId: deliveryId,
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })));
    const invalidDevices = response.responses.flatMap((result, index) => {
      const device = devices[index];
      return !result.success && device && isPermanentTokenError(result.error?.code)
        ? [device.reference]
        : [];
    });
    await Promise.all(invalidDevices.map((reference) => reference.delete()));
    await delivery.update({
      status: response.successCount > 0 ? 'sent' : 'failed',
      successfulDeviceCount: response.successCount,
      failedDeviceCount: response.failureCount,
      invalidDeviceCount: invalidDevices.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('Group message notification delivery completed.', {
      deliveryId,
      recipientUid,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: unknown) {
    await delivery.update({ status: 'failed', updatedAt: FieldValue.serverTimestamp() });
    logger.warn('Group message notification delivery failed.', { deliveryId, recipientUid, error });
  }
}

export async function processGroupChatMessage(input: {
  database: Firestore;
  groupId: string;
  messageId: string;
  messaging: Messaging;
  value: unknown;
}): Promise<void> {
  const { database, groupId, messageId, messaging, value } = input;
  if (isRecord(value) && value.developmentSeed === true) return;
  const message = parseGroupChatMessage(messageId, value);
  if (!message) {
    logger.warn('Malformed group message event ignored.', { groupId, messageId });
    return;
  }
  const expectedMediaPath = message.type === 'text'
    ? null
    : `devreGroups/${groupId}/media/${messageId}/${message.type === 'image' ? 'image.jpg' : message.type === 'audio' ? 'audio.m4a' : 'document'}`;
  if (message.mediaPath !== expectedMediaPath) {
    logger.warn('Group message with an invalid media path ignored.', { groupId, messageId });
    return;
  }
  const [group, senderMembership, senderProfile, members] = await Promise.all([
    database.doc(`devreGroups/${groupId}`).get(),
    database.doc(`devreGroups/${groupId}/members/${message.senderUid}`).get(),
    database.doc(`publicProfiles/${message.senderUid}`).get(),
    database.collection(`devreGroups/${groupId}/members`).limit(memberLimit + 1).get(),
  ]);
  if (!group.exists || !senderMembership.exists) {
    logger.warn('Untrusted group message event ignored.', { groupId, messageId });
    return;
  }
  if (members.size > memberLimit) {
    logger.error('Group notification fan-out exceeded its safety limit.', { groupId, messageId, memberLimit });
    return;
  }
  const senderName = senderProfile.exists && typeof senderProfile.get('firstName') === 'string'
    ? senderProfile.get('firstName') as string
    : 'Bir devren';
  const recipientUids = selectGroupMessageRecipients(
    members.docs.map((document) => document.id),
    message.senderUid,
  );
  for (let index = 0; index < recipientUids.length; index += 10) {
    await Promise.all(recipientUids.slice(index, index + 10).map((recipientUid) => notifyRecipient({
      database,
      groupId,
      messageId,
      messaging,
      recipientUid,
      senderName,
      senderUid: message.senderUid,
      message,
    })));
  }
}

export async function deleteGroupNotificationDataForUser(database: Firestore, uid: string): Promise<void> {
  const collection = database.collection('_groupMessageNotificationDeliveries');
  const [recipient, sender] = await Promise.all([
    collection.where('recipientUid', '==', uid).get(),
    collection.where('senderUid', '==', uid).get(),
  ]);
  const references = new Map<string, DocumentReference>();
  for (const snapshot of [recipient, sender]) {
    for (const document of snapshot.docs) references.set(document.ref.path, document.ref);
  }
  for (let index = 0; index < references.size; index += 400) {
    const chunk = [...references.values()].slice(index, index + 400);
    const batch = database.batch();
    for (const reference of chunk) batch.delete(reference);
    await batch.commit();
  }
}
