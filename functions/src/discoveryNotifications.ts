import { createHash } from 'node:crypto';

import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Query,
} from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';

import {
  createDiscoveryNotificationCopy,
  decideMembershipTransition,
  getDeliveryReservationDecision,
  getDiscoveryNotificationReason,
  getMembershipFingerprint,
  getUtcDayBucket,
  hasExactDevreIdentity,
  type MembershipState,
  type NotificationPreferences,
  type NotificationProfile,
} from './discoveryNotificationDomain.js';
import { createPublicProfileProjection } from './publicProfile.js';

const recipientQueryLimit = 200;
const deliveryRetentionDays = 30;
const registrationFreshnessDays = 30;
const controlDocumentPath = '_notificationControl/discovery';
const seedMarkerPath = '_developmentSeeds/discovery';

interface DeviceRegistration {
  reference: DocumentReference;
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNotificationProfile(userId: string, value: unknown): NotificationProfile | null {
  if (!userId || !isRecord(value)) return null;
  const militaryUnitId = value.militaryUnitId ?? null;
  const militaryUnitName = value.militaryUnitName ?? value.militaryUnit ?? null;
  const militaryTypes = ['standard', 'paid', 'reserveOfficer', 'reserveNco'];
  if (
    typeof value.firstName !== 'string'
    || typeof value.residenceCity !== 'number'
    || typeof value.departureCity !== 'number'
    || typeof value.militaryCity !== 'number'
    || typeof value.militaryPeriodYear !== 'number'
    || typeof value.militaryPeriodMonth !== 'number'
    || typeof value.militaryType !== 'string'
    || !militaryTypes.includes(value.militaryType)
    || !(militaryUnitId === null || typeof militaryUnitId === 'string')
    || !(militaryUnitName === null || typeof militaryUnitName === 'string')
    || !(value.photoPath === null || typeof value.photoPath === 'string')
  ) return null;
  return {
    userId,
    firstName: value.firstName,
    residenceCity: value.residenceCity,
    departureCity: value.departureCity,
    militaryCity: value.militaryCity,
    militaryPeriodYear: value.militaryPeriodYear,
    militaryPeriodMonth: value.militaryPeriodMonth,
    militaryType: value.militaryType as NotificationProfile['militaryType'],
    militaryUnitId,
    militaryUnitName,
    photoPath: value.photoPath,
  };
}

function parsePreferences(value: unknown): NotificationPreferences | null {
  if (!isRecord(value) || !isRecord(value.discovery) || typeof value.enabled !== 'boolean') return null;
  const discovery = value.discovery;
  if (
    typeof discovery.newDevre !== 'boolean'
    || typeof discovery.sameResidenceCity !== 'boolean'
    || typeof discovery.sameDepartureCity !== 'boolean'
  ) return null;
  return {
    enabled: value.enabled,
    discovery: {
      newDevre: discovery.newDevre,
      sameResidenceCity: discovery.sameResidenceCity,
      sameDepartureCity: discovery.sameDepartureCity,
    },
  };
}

function parseMembershipState(value: unknown): MembershipState | null {
  if (
    !isRecord(value)
    || typeof value.active !== 'boolean'
    || !(value.fingerprint === null || typeof value.fingerprint === 'string')
    || !(value.lastJoinEventId === null || value.lastJoinEventId === undefined || typeof value.lastJoinEventId === 'string')
    || typeof value.version !== 'number'
    || !Number.isInteger(value.version)
    || value.version < 0
  ) return null;
  return {
    active: value.active,
    fingerprint: value.fingerprint,
    lastJoinEventId: typeof value.lastJoinEventId === 'string' ? value.lastJoinEventId : null,
    version: value.version,
  };
}

async function getDevelopmentSeedIds(database: Firestore): Promise<Set<string>> {
  const snapshot = await database.doc(seedMarkerPath).get();
  const seededIds = snapshot.exists ? snapshot.get('seededIds') : null;
  return new Set(Array.isArray(seededIds) ? seededIds.filter((value): value is string => typeof value === 'string') : []);
}

async function updateMembershipState(input: {
  beforeFingerprint: string | null;
  database: Firestore;
  nextFingerprint: string | null;
  sourceEventId: string;
  uid: string;
}): Promise<number | null> {
  const { beforeFingerprint, database, nextFingerprint, sourceEventId, uid } = input;
  const controlReference = database.doc(controlDocumentPath);
  const membershipReference = database.doc(`_notificationMemberships/${uid}`);
  return database.runTransaction(async (transaction) => {
    const [controlSnapshot, membershipSnapshot] = await Promise.all([
      transaction.get(controlReference),
      transaction.get(membershipReference),
    ]);
    const previousState = membershipSnapshot.exists
      ? parseMembershipState(membershipSnapshot.data())
      : null;
    if (!previousState && nextFingerprint === null) return null;
    const transition = decideMembershipTransition({
      beforeFingerprint,
      nextFingerprint,
      previousState,
      notificationsEnabled: controlSnapshot.get('enabled') === true,
      sourceEventId,
      source: 'live',
    });
    transaction.set(membershipReference, {
      uid,
      ...transition.nextState,
      ...(membershipSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      ...(transition.shouldNotify ? { joinedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return transition.shouldNotify ? transition.nextState.version : null;
  });
}

async function findExactRecipients(
  database: Firestore,
  joiningProfile: NotificationProfile,
  seedIds: Set<string>,
): Promise<NotificationProfile[]> {
  let profilesQuery: Query<DocumentData> = database.collection('publicProfiles')
    .where('militaryPeriodYear', '==', joiningProfile.militaryPeriodYear)
    .where('militaryPeriodMonth', '==', joiningProfile.militaryPeriodMonth)
    .where('militaryCity', '==', joiningProfile.militaryCity)
    .where('militaryType', '==', joiningProfile.militaryType);
  if (joiningProfile.militaryUnitId) {
    profilesQuery = profilesQuery.where('militaryUnitId', '==', joiningProfile.militaryUnitId);
  }
  const snapshot = await profilesQuery.limit(recipientQueryLimit).get();
  return snapshot.docs.flatMap((documentSnapshot) => {
    if (documentSnapshot.id === joiningProfile.userId || seedIds.has(documentSnapshot.id)) return [];
    const profile = parseNotificationProfile(documentSnapshot.id, documentSnapshot.data());
    return profile && hasExactDevreIdentity(joiningProfile, profile) ? [profile] : [];
  });
}

function createDeliveryId(recipientUid: string, joiningUid: string, membershipVersion: number): string {
  return createHash('sha256')
    .update(`${recipientUid}\u0000${joiningUid}\u0000${membershipVersion}`)
    .digest('hex');
}

async function reserveDelivery(input: {
  database: Firestore;
  joiningProfile: NotificationProfile;
  membershipVersion: number;
  reason: NonNullable<ReturnType<typeof getDiscoveryNotificationReason>>;
  recipientUid: string;
}): Promise<{ deliveryId: string; reserved: boolean }> {
  const { database, joiningProfile, membershipVersion, reason, recipientUid } = input;
  const now = Timestamp.now();
  const dayBucket = getUtcDayBucket(now.toDate());
  const deliveryId = createDeliveryId(recipientUid, joiningProfile.userId, membershipVersion);
  const deliveryReference = database.doc(`_notificationDeliveries/${deliveryId}`);
  const rateReference = database.doc(`_notificationRateLimits/${recipientUid}_${dayBucket}`);
  const expiresAt = Timestamp.fromMillis(now.toMillis() + deliveryRetentionDays * 24 * 60 * 60 * 1000);
  return database.runTransaction(async (transaction) => {
    const [deliverySnapshot, rateSnapshot] = await Promise.all([
      transaction.get(deliveryReference),
      transaction.get(rateReference),
    ]);
    const currentDailyCount = rateSnapshot.exists && typeof rateSnapshot.get('count') === 'number'
      ? rateSnapshot.get('count') as number
      : 0;
    const decision = getDeliveryReservationDecision({
      currentDailyCount,
      deliveryAlreadyExists: deliverySnapshot.exists,
    });
    if (decision === 'duplicate') return { deliveryId, reserved: false };

    transaction.create(deliveryReference, {
      deliveryId,
      recipientUid,
      joiningUserUid: joiningProfile.userId,
      membershipVersion,
      reason,
      dayBucket,
      aggregationKey: getMembershipFingerprint(joiningProfile),
      status: decision === 'send' ? 'reserved' : 'rate-limited',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    });
    if (decision === 'rate-limited') return { deliveryId, reserved: false };
    transaction.set(rateReference, {
      recipientUid,
      dayBucket,
      count: currentDailyCount + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now.toMillis() + 2 * 24 * 60 * 60 * 1000),
    }, { merge: true });
    return { deliveryId, reserved: true };
  });
}

async function getFreshDeviceRegistrations(
  database: Firestore,
  recipientUid: string,
): Promise<DeviceRegistration[]> {
  const cutoff = Date.now() - registrationFreshnessDays * 24 * 60 * 60 * 1000;
  const snapshot = await database.collection(`users/${recipientUid}/devices`).limit(10).get();
  const staleReferences: DocumentReference[] = [];
  const registrations = snapshot.docs.flatMap((documentSnapshot) => {
    const token = documentSnapshot.get('token');
    const enabled = documentSnapshot.get('enabled');
    const lastSeenAt = documentSnapshot.get('lastSeenAt');
    if (
      enabled !== true
      || typeof token !== 'string'
      || !(lastSeenAt instanceof Timestamp)
      || lastSeenAt.toMillis() < cutoff
    ) {
      if (lastSeenAt instanceof Timestamp && lastSeenAt.toMillis() < cutoff) staleReferences.push(documentSnapshot.ref);
      return [];
    }
    return [{ reference: documentSnapshot.ref, token }];
  });
  await Promise.all(staleReferences.map((reference) => reference.delete()));
  return registrations;
}

function isPermanentTokenError(code: string | undefined): boolean {
  return code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token'
    || code === 'messaging/invalid-argument';
}

async function sendReservedDelivery(input: {
  database: Firestore;
  deliveryId: string;
  joiningProfile: NotificationProfile;
  messaging: Messaging;
  reason: NonNullable<ReturnType<typeof getDiscoveryNotificationReason>>;
  recipientUid: string;
}): Promise<void> {
  const { database, deliveryId, joiningProfile, messaging, reason, recipientUid } = input;
  const deliveryReference = database.doc(`_notificationDeliveries/${deliveryId}`);
  const registrations = await getFreshDeviceRegistrations(database, recipientUid);
  if (registrations.length === 0) {
    await deliveryReference.update({ status: 'no-active-devices', updatedAt: FieldValue.serverTimestamp() });
    return;
  }

  const copy = createDiscoveryNotificationCopy(reason, joiningProfile.firstName);
  try {
    const response = await messaging.sendEach(registrations.map(({ token }) => ({
      token,
      notification: copy,
      data: {
        type: 'discovery.newDevre',
        target: 'profile',
        profileUserId: joiningProfile.userId,
        eventId: deliveryId,
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })));
    const invalidReferences = response.responses.flatMap((sendResponse, index) => {
      const registration = registrations[index];
      return !sendResponse.success && registration && isPermanentTokenError(sendResponse.error?.code)
        ? [registration.reference]
        : [];
    });
    await Promise.all(invalidReferences.map((reference) => reference.delete()));
    await deliveryReference.update({
      status: response.successCount > 0 ? 'sent' : 'failed',
      successfulDeviceCount: response.successCount,
      failedDeviceCount: response.failureCount,
      invalidDeviceCount: invalidReferences.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('Discovery notification delivery completed.', {
      deliveryId,
      recipientUid,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: unknown) {
    await deliveryReference.update({ status: 'failed', updatedAt: FieldValue.serverTimestamp() });
    logger.warn('Discovery notification delivery failed.', { deliveryId, recipientUid, error });
  }
}

async function notifyExactRecipients(input: {
  database: Firestore;
  joiningProfile: NotificationProfile;
  membershipVersion: number;
  messaging: Messaging;
  seedIds: Set<string>;
}): Promise<void> {
  const { database, joiningProfile, membershipVersion, messaging, seedIds } = input;
  const recipients = await findExactRecipients(database, joiningProfile, seedIds);
  for (let index = 0; index < recipients.length; index += 10) {
    await Promise.all(recipients.slice(index, index + 10).map(async (recipientProfile) => {
      const preferencesSnapshot = await database.doc(
        `users/${recipientProfile.userId}/notificationPreferences/main`,
      ).get();
      const preferences = preferencesSnapshot.exists ? parsePreferences(preferencesSnapshot.data()) : null;
      if (!preferences) return;
      const reason = getDiscoveryNotificationReason(joiningProfile, recipientProfile, preferences);
      if (!reason) return;
      const reservation = await reserveDelivery({
        database,
        joiningProfile,
        membershipVersion,
        reason,
        recipientUid: recipientProfile.userId,
      });
      if (!reservation.reserved) return;
      await sendReservedDelivery({
        database,
        deliveryId: reservation.deliveryId,
        joiningProfile,
        messaging,
        reason,
        recipientUid: recipientProfile.userId,
      });
    }));
  }
}

export async function processDiscoveryMembershipChange(input: {
  beforePrivateProfile: unknown;
  database: Firestore;
  messaging: Messaging;
  sourceEventId: string;
  uid: string;
}): Promise<void> {
  const { beforePrivateProfile, database, messaging, sourceEventId, uid } = input;
  const seedIds = await getDevelopmentSeedIds(database);
  if (seedIds.has(uid)) return;
  const publicSnapshot = await database.doc(`publicProfiles/${uid}`).get();
  const joiningProfile = publicSnapshot.exists
    ? parseNotificationProfile(uid, publicSnapshot.data())
    : null;
  const beforeProjection = createPublicProfileProjection(uid, beforePrivateProfile);
  const membershipVersion = await updateMembershipState({
    beforeFingerprint: getMembershipFingerprint(beforeProjection),
    database,
    nextFingerprint: getMembershipFingerprint(joiningProfile),
    sourceEventId,
    uid,
  });
  if (membershipVersion === null || !joiningProfile) return;
  await notifyExactRecipients({ database, joiningProfile, membershipVersion, messaging, seedIds });
}

async function deleteReferences(references: DocumentReference[]): Promise<void> {
  for (let index = 0; index < references.length; index += 400) {
    const batch = references[index]?.firestore.batch();
    if (!batch) continue;
    for (const reference of references.slice(index, index + 400)) batch.delete(reference);
    await batch.commit();
  }
}

export async function deleteNotificationDataForUser(database: Firestore, uid: string): Promise<void> {
  const [recipientDeliveries, joiningDeliveries, rateLimits] = await Promise.all([
    database.collection('_notificationDeliveries').where('recipientUid', '==', uid).get(),
    database.collection('_notificationDeliveries').where('joiningUserUid', '==', uid).get(),
    database.collection('_notificationRateLimits').where('recipientUid', '==', uid).get(),
  ]);
  const references = new Map<string, DocumentReference>();
  references.set(`_notificationMemberships/${uid}`, database.doc(`_notificationMemberships/${uid}`));
  for (const snapshot of [recipientDeliveries, joiningDeliveries, rateLimits]) {
    for (const documentSnapshot of snapshot.docs) references.set(documentSnapshot.ref.path, documentSnapshot.ref);
  }
  await deleteReferences([...references.values()]);
}