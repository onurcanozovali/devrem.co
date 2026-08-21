/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const projectId = 'devrem-rules-test';
let environment: RulesTestEnvironment;

function profileData(uid: string, year: number, month: number) {
  return {
    uid,
    firstName: 'Onur',
    lastName: 'Özovalı',
    birthYear: 2000,
    residenceCity: 34,
    departureCity: 34,
    militaryCity: 6,
    militaryType: 'standard',
    militaryPeriodYear: year,
    militaryPeriodMonth: month,
    militaryUnit: '1. Piyade Tugayı',
    reportingDate: `${year}-${String(month).padStart(2, '0')}-10`,
    onboardingCompleted: true,
    createdAt: Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
  };
}

async function seedProfile(uid: string, year: number, month: number) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), profileData(uid, year, month));
  });
}

async function seedPublicProfile(uid: string, year: number, month: number) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'publicProfiles', uid), {
      firstName: 'Onur',
      residenceCity: 34,
      departureCity: 34,
      militaryCity: 6,
      militaryType: 'standard',
      militaryPeriodYear: year,
      militaryPeriodMonth: month,
      militaryUnitName: '1. Piyade Tugayı',
      photoPath: null,
      updatedAt: Timestamp.fromDate(new Date('2026-08-09T00:00:00Z')),
    });
  });
}

async function seedDevreGroup(groupId: string, memberIds: string[]) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, 'devreGroups', groupId), {
      groupId,
      militaryPeriodYear: 2027,
      militaryPeriodMonth: 2,
      militaryCity: 6,
      militaryType: 'standard',
      militaryUnitId: null,
      militaryUnitName: '1. Piyade Tugayı',
      schemaVersion: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    for (const uid of memberIds) {
      await setDoc(doc(database, 'devreGroups', groupId, 'members', uid), {
        uid,
        status: 'active',
        source: 'backfill',
        schemaVersion: 1,
        joinedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await setDoc(doc(database, '_devreGroupMemberships', uid), {
        uid,
        groupId,
        identityKey: 'identity',
        schemaVersion: 1,
        source: 'backfill',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  });
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await environment.cleanup();
});

test('owner may update profile with a current or future period', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  const nextYear = new Date().getFullYear() + 1;
  await assertSucceeds(updateDoc(reference, {
    militaryPeriodYear: nextYear,
    militaryPeriodMonth: 1,
    reportingDate: `${nextYear}-01-10`,
    updatedAt: serverTimestamp(),
  }));
});

test('owner may edit another field while preserving the exact historical period', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertSucceeds(updateDoc(reference, { firstName: 'Onur Can', updatedAt: serverTimestamp() }));
});

test('owner cannot change a historical profile to a different past period', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertFails(updateDoc(reference, {
    militaryPeriodMonth: 8,
    reportingDate: '2025-08-10',
    updatedAt: serverTimestamp(),
  }));
});

test('users cannot update another profile or delete their own profile directly', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const otherUserReference = doc(environment.authenticatedContext('user-2').firestore(), 'users', 'user-1');
  await assertFails(updateDoc(otherUserReference, { firstName: 'Başka', updatedAt: serverTimestamp() }));

  const ownerReference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertFails(deleteDoc(ownerReference));
  assert.ok(true);
});

test('owner may set only their deterministic optional profile photo path', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertSucceeds(updateDoc(reference, {
    photoPath: 'users/user-1/profile/avatar.jpg',
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(reference, {
    photoPath: 'users/user-2/profile/avatar.jpg',
    updatedAt: serverTimestamp(),
  }));
});

test('only exact Devre discovery queries may browse public projections', async () => {
  await environment.clearFirestore();
  await seedProfile('user-2', 2027, 2);
  await seedPublicProfile('user-1', 2027, 2);
  const authenticatedDatabase = environment.authenticatedContext('user-2').firestore();
  await assertSucceeds(getDoc(doc(authenticatedDatabase, 'publicProfiles', 'user-1')));
  const results = await assertSucceeds(getDocs(query(
    collection(authenticatedDatabase, 'publicProfiles'),
    where('militaryPeriodYear', '==', 2027),
    where('militaryPeriodMonth', '==', 2),
    where('militaryCity', '==', 6),
    where('militaryType', '==', 'standard'),
    where('militaryUnitName', '==', '1. Piyade Tugayı'),
  )));
  assert.equal(results.size, 1);

  await seedProfile('user-3', 2027, 3);
  const arbitraryDatabase = environment.authenticatedContext('user-3').firestore();
  await assertFails(getDoc(doc(arbitraryDatabase, 'publicProfiles', 'user-1')));
  await assertFails(getDocs(collection(arbitraryDatabase, 'publicProfiles')));

  const unauthenticatedDatabase = environment.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(unauthenticatedDatabase, 'publicProfiles')));
});

test('active group members may read member profiles but missing membership status grants no access', async () => {
  await environment.clearFirestore();
  const groupId = `devre-v1-${'e'.repeat(64)}`;
  await seedPublicProfile('user-2', 2027, 2);
  await seedDevreGroup(groupId, ['user-1', 'user-2']);
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('user-1').firestore(), 'publicProfiles', 'user-2')));
  await environment.withSecurityRulesDisabled(async (context) => updateDoc(
    doc(context.firestore(), 'devreGroups', groupId, 'members', 'user-1'),
    { status: null },
  ));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-1').firestore(), 'devreGroups', groupId)));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-1').firestore(), 'publicProfiles', 'user-2')));
});

test('clients cannot spoof, update, or delete public projections', async () => {
  await environment.clearFirestore();
  await seedPublicProfile('user-1', 2027, 2);
  const ownerDatabase = environment.authenticatedContext('user-1').firestore();
  const ownerReference = doc(ownerDatabase, 'publicProfiles', 'user-1');
  await assertFails(updateDoc(ownerReference, { firstName: 'Sahte' }));
  await assertFails(deleteDoc(ownerReference));
  await assertFails(setDoc(doc(ownerDatabase, 'publicProfiles', 'user-2'), {
    firstName: 'Sahte',
    militaryPeriodYear: 2027,
    militaryPeriodMonth: 2,
  }));
});

test('public discovery access does not expose another private user profile', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2027, 2);
  const otherDatabase = environment.authenticatedContext('user-2').firestore();
  await assertFails(getDoc(doc(otherDatabase, 'users', 'user-1')));
});

test('notification preferences are owner-private and preserve strict discovery keys', async () => {
  await environment.clearFirestore();
  const ownerDatabase = environment.authenticatedContext('user-1').firestore();
  const preferenceReference = doc(ownerDatabase, 'users/user-1/notificationPreferences/main');
  await assertSucceeds(setDoc(preferenceReference, {
    enabled: true,
    groupMessagesEnabled: true,
    discovery: {
      newDevre: true,
      sameResidenceCity: true,
      sameDepartureCity: true,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(preferenceReference, {
    enabled: false,
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(preferenceReference));

  const otherDatabase = environment.authenticatedContext('user-2').firestore();
  await assertFails(getDoc(doc(otherDatabase, 'users/user-1/notificationPreferences/main')));
  await assertFails(updateDoc(doc(otherDatabase, 'users/user-1/notificationPreferences/main'), {
    enabled: true,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(preferenceReference, {
    social: { message: true },
    updatedAt: serverTimestamp(),
  }));
});

test('device registrations are owner-private and cannot be enumerated by another user', async () => {
  await environment.clearFirestore();
  const ownerDatabase = environment.authenticatedContext('user-1').firestore();
  const deviceReference = doc(ownerDatabase, 'users/user-1/devices/install-1');
  await assertSucceeds(setDoc(deviceReference, {
    installationId: 'install-1',
    token: 'fcm-registration-token-at-least-twenty-characters',
    platform: 'android',
    enabled: true,
    appVersion: '1.0.0',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(deviceReference));
  await assertSucceeds(updateDoc(deviceReference, {
    token: 'refreshed-registration-token-at-least-twenty-characters',
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }));

  const otherDatabase = environment.authenticatedContext('user-2').firestore();
  await assertFails(getDoc(doc(otherDatabase, 'users/user-1/devices/install-1')));
  await assertFails(getDocs(collection(otherDatabase, 'users/user-1/devices')));
  await assertFails(updateDoc(doc(otherDatabase, 'users/user-1/devices/install-1'), {
    enabled: false,
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(ownerDatabase, 'users/user-1/devices/install-2'), {
    installationId: 'different-installation',
    token: 'short',
    platform: 'android',
    enabled: true,
    appVersion: '1.0.0',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }));
});

test('trusted notification state remains inaccessible to clients', async () => {
  await environment.clearFirestore();
  const database = environment.authenticatedContext('user-1').firestore();
  for (const path of [
    '_notificationControl/discovery',
    '_notificationMemberships/user-1',
    '_notificationDeliveries/event-1',
    '_notificationRateLimits/user-1_20260810',
    '_groupMessageNotificationDeliveries/event-2',
  ]) {
    await assertFails(getDoc(doc(database, path)));
    await assertFails(setDoc(doc(database, path), { enabled: true }));
  }
});

test('communication preferences are owner-private and default-compatible', async () => {
  await environment.clearFirestore();
  const ownerDatabase = environment.authenticatedContext('user-1').firestore();
  const reference = doc(ownerDatabase, 'users/user-1/communicationPreferences/main');
  await assertSucceeds(setDoc(reference, {
    allowDirectMessages: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(reference, { allowDirectMessages: false, updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-2').firestore(), 'users/user-1/communicationPreferences/main')));
  await assertFails(setDoc(doc(environment.authenticatedContext('user-2').firestore(), 'users/user-1/communicationPreferences/main'), {
    allowDirectMessages: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('only group members can read a Devre group and its member list', async () => {
  await environment.clearFirestore();
  const groupId = `devre-v1-${'a'.repeat(64)}`;
  await seedDevreGroup(groupId, ['user-1', 'user-2']);
  const memberDatabase = environment.authenticatedContext('user-1').firestore();
  await assertSucceeds(getDoc(doc(memberDatabase, 'devreGroups', groupId)));
  const members = await assertSucceeds(getDocs(collection(memberDatabase, 'devreGroups', groupId, 'members')));
  assert.equal(members.size, 2);
  const outsiderDatabase = environment.authenticatedContext('user-3').firestore();
  await assertFails(getDoc(doc(outsiderDatabase, 'devreGroups', groupId)));
  await assertFails(getDocs(collection(outsiderDatabase, 'devreGroups', groupId, 'members')));
});

test('clients can read only their membership pointer and cannot mutate group membership', async () => {
  await environment.clearFirestore();
  const groupId = `devre-v1-${'b'.repeat(64)}`;
  await seedDevreGroup(groupId, ['user-1']);
  const ownerDatabase = environment.authenticatedContext('user-1').firestore();
  await assertSucceeds(getDoc(doc(ownerDatabase, '_devreGroupMemberships', 'user-1')));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-2').firestore(), '_devreGroupMemberships', 'user-1')));
  await environment.withSecurityRulesDisabled(async (context) => setDoc(
    doc(context.firestore(), '_travelGroupMemberships', 'user-1'),
    { uid: 'user-1', groupId: `travel-v1-${'c'.repeat(64)}` },
  ));
  await assertSucceeds(getDoc(doc(ownerDatabase, '_travelGroupMemberships', 'user-1')));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-2').firestore(), '_travelGroupMemberships', 'user-1')));
  await assertFails(setDoc(doc(ownerDatabase, 'devreGroups', groupId, 'members', 'user-2'), {
    uid: 'user-2',
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(doc(ownerDatabase, 'devreGroups', groupId, 'members', 'user-1')));
});

test('legal acceptance is versioned, owner-private, and uses acknowledgement semantics', async () => {
  await environment.clearFirestore();
  const ownerDatabase = environment.authenticatedContext('user-1').firestore();
  const reference = doc(ownerDatabase, 'users/user-1/legal/acceptance');
  await assertSucceeds(setDoc(reference, {
    termsAcceptedVersion: '2026-08-20-v1',
    termsAcceptedAt: serverTimestamp(),
    privacyNoticeAcknowledgedVersion: '2026-08-20-v1',
    privacyNoticeAcknowledgedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(reference));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-2').firestore(), 'users/user-1/legal/acceptance')));
  await assertFails(setDoc(doc(environment.authenticatedContext('user-2').firestore(), 'users/user-1/legal/acceptance'), {
    termsAcceptedVersion: '2026-08-20-v1',
    termsAcceptedAt: serverTimestamp(),
    privacyNoticeAcknowledgedVersion: '2026-08-20-v1',
    privacyNoticeAcknowledgedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(reference, {
    termsAcceptedVersion: '2026-08-20-v1',
    termsAcceptedAt: serverTimestamp(),
    privacyConsentVersion: '2026-08-20-v1',
    privacyConsentAt: serverTimestamp(),
  }));
  await assertFails(setDoc(reference, {
    termsAcceptedVersion: 'old-version',
    termsAcceptedAt: serverTimestamp(),
    privacyNoticeAcknowledgedVersion: '2026-08-20-v1',
    privacyNoticeAcknowledgedAt: serverTimestamp(),
  }));
});

test('a departed member immediately loses group read and message write access', async () => {
  await environment.clearFirestore();
  const groupId = `devre-v1-${'f'.repeat(64)}`;
  await seedDevreGroup(groupId, ['user-1', 'user-2']);
  await environment.withSecurityRulesDisabled(async (context) => setDoc(
    doc(context.firestore(), 'devreGroups', groupId, 'members', 'user-1'),
    { status: 'left', leftAt: Timestamp.now() },
    { merge: true },
  ));
  const departed = environment.authenticatedContext('user-1').firestore();
  await assertFails(getDoc(doc(departed, 'devreGroups', groupId)));
  await assertFails(getDocs(collection(departed, 'devreGroups', groupId, 'messages')));
  await assertFails(setDoc(doc(departed, 'devreGroups', groupId, 'messages', 'after-leaving'), {
    id: 'after-leaving', senderUid: 'user-1', type: 'text', text: 'Yetkisiz',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
});

test('direct conversations are private to two immutable participants and blocks stop sends', async () => {
  await environment.clearFirestore();
  const conversationId = `direct-v1-${'d'.repeat(64)}`;
  await environment.withSecurityRulesDisabled(async (context) => setDoc(
    doc(context.firestore(), 'directConversations', conversationId),
    {
      conversationId,
      type: 'direct',
      participantUids: ['user-1', 'user-2'],
      schemaVersion: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastMessageAt: null,
    },
  ));
  const first = environment.authenticatedContext('user-1').firestore();
  const second = environment.authenticatedContext('user-2').firestore();
  const third = environment.authenticatedContext('user-3').firestore();
  await assertSucceeds(getDoc(doc(first, 'directConversations', conversationId)));
  await assertSucceeds(getDoc(doc(second, 'directConversations', conversationId)));
  await assertFails(getDoc(doc(third, 'directConversations', conversationId)));
  const message = {
    id: 'dm-1', senderUid: 'user-1', type: 'text', text: 'Selam',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: null, schemaVersion: 1,
  };
  await assertSucceeds(setDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-1'), message));
  await assertSucceeds(setDoc(doc(second, 'directConversations', conversationId, 'messages', 'dm-2'), {
    ...message, id: 'dm-2', senderUid: 'user-2', text: 'Merhaba', replyToMessageId: 'dm-1',
  }));
  await assertSucceeds(setDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-image'), {
    id: 'dm-image', senderUid: 'user-1', type: 'image',
    mediaPath: `directConversations/${conversationId}/media/dm-image/image.jpg`,
    caption: 'Fotoğraf', width: 1200, height: 900,
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: null, schemaVersion: 1,
  }));
  await assertSucceeds(setDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-document'), {
    id: 'dm-document', senderUid: 'user-1', type: 'document',
    mediaPath: `directConversations/${conversationId}/media/dm-document/document`,
    fileName: 'belge.pdf', mimeType: 'application/pdf', sizeBytes: 4096, extension: 'pdf',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: 'dm-2', schemaVersion: 1,
  }));
  await assertFails(setDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-bad-reply'), {
    ...message, id: 'dm-bad-reply', replyToMessageId: 'missing-message',
  }));
  await assertFails(setDoc(doc(second, 'directConversations', conversationId, 'messages', 'dm-spoof'), {
    ...message, id: 'dm-spoof', senderUid: 'user-1',
  }));
  await assertFails(setDoc(doc(third, 'directConversations', conversationId, 'messages', 'dm-2'), {
    ...message, id: 'dm-2', senderUid: 'user-3',
  }));
  await assertFails(updateDoc(doc(first, 'directConversations', conversationId), {
    participantUids: ['user-1', 'user-2', 'user-3'],
  }));
  await assertSucceeds(setDoc(doc(second, 'users', 'user-2', 'blockedUsers', 'user-1'), {
    blockedUid: 'user-1', createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-3'), {
    ...message, id: 'dm-3',
  }));
  await assertFails(setDoc(doc(second, 'directConversations', conversationId, 'messages', 'dm-3b'), {
    ...message, id: 'dm-3b', senderUid: 'user-2',
  }));
  await assertSucceeds(getDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-1')));
  await assertSucceeds(getDoc(doc(second, 'directConversations', conversationId)));
  await assertSucceeds(deleteDoc(doc(second, 'users', 'user-2', 'blockedUsers', 'user-1')));
  await assertSucceeds(setDoc(doc(first, 'directConversations', conversationId, 'messages', 'dm-4'), {
    ...message, id: 'dm-4', replyToMessageId: 'dm-2',
  }));
  await assertSucceeds(setDoc(doc(first, 'moderationReports', 'report-1'), {
    reporterUid: 'user-1', reportedUid: 'user-2', conversationType: 'direct', conversationId,
    messageId: 'dm-2', reason: 'Spam', status: 'open', createdAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(doc(first, 'directConversations', conversationId)));
  const blockAfterReport = await assertSucceeds(getDoc(doc(first, 'users', 'user-1', 'blockedUsers', 'user-2')));
  assert.equal(blockAfterReport.exists(), false);
  const stateAfterReport = await assertSucceeds(getDoc(doc(first, 'directConversations', conversationId, 'participantStates', 'user-1')));
  assert.equal(stateAfterReport.exists(), false);
  await assertFails(setDoc(doc(third, 'moderationReports', 'report-2'), {
    reporterUid: 'user-3', reportedUid: 'user-2', conversationType: 'direct', conversationId,
    messageId: null, reason: 'Spam', status: 'open', createdAt: serverTimestamp(),
  }));
  const hidden = doc(first, 'users', 'user-1', 'hiddenDirectMessages', conversationId, 'messages', 'dm-2');
  await assertSucceeds(setDoc(hidden, { conversationId, messageId: 'dm-2', hiddenAt: serverTimestamp() }));
  await assertSucceeds(getDoc(hidden));
  await assertFails(getDoc(doc(second, 'users', 'user-1', 'hiddenDirectMessages', conversationId, 'messages', 'dm-2')));
  const hiddenConversation = doc(first, 'directConversations', conversationId, 'participantStates', 'user-1');
  await assertSucceeds(setDoc(hiddenConversation, { uid: 'user-1', unreadCount: 0, hidden: true, hiddenAt: serverTimestamp() }));
  await assertSucceeds(getDoc(hiddenConversation));
  await assertFails(getDoc(doc(second, 'directConversations', conversationId, 'participantStates', 'user-1')));
  const ownerStates = await assertSucceeds(getDocs(query(
    collectionGroup(first, 'participantStates'),
    where('uid', '==', 'user-1'),
  )));
  assert.equal(ownerStates.size, 1);
  await assertFails(getDocs(query(
    collectionGroup(second, 'participantStates'),
    where('uid', '==', 'user-1'),
  )));
  await assertSucceeds(getDoc(doc(second, 'directConversations', conversationId)));
});

test('owner may save canonical unit fields but invalid force codes are rejected', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertSucceeds(updateDoc(reference, {
    militaryUnit: 'Hava Er Eğitim Tugay Komutanlığı',
    militaryUnitId: 'air-43-hava-er-egitim-tugay-komutanligi',
    militaryUnitNameSnapshot: 'Hava Er Eğitim Tugay Komutanlığı',
    forceCode: 'air',
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(reference, {
    forceCode: 'unknown-force',
    updatedAt: serverTimestamp(),
  }));
});

test('group messages are member-only, immutable, bounded, and sender-authenticated', async () => {
  await environment.clearFirestore();
  const groupId = `devre-v1-${'c'.repeat(64)}`;
  await seedDevreGroup(groupId, ['user-1', 'user-2']);
  const memberDatabase = environment.authenticatedContext('user-1').firestore();
  const messageReference = doc(memberDatabase, 'devreGroups', groupId, 'messages', 'message-1');
  await assertSucceeds(setDoc(messageReference, {
    id: 'message-1',
    senderUid: 'user-1',
    type: 'text',
    text: 'Selam\ndevre',
    createdAt: serverTimestamp(),
    clientCreatedAt: Timestamp.now(),
    schemaVersion: 3,
  }));
  await assertSucceeds(setDoc(doc(environment.authenticatedContext('user-2').firestore(), 'moderationReports', 'group-report-1'), {
    reporterUid: 'user-2', reportedUid: 'user-1', conversationType: 'group', conversationId: groupId,
    messageId: 'message-1', reason: 'Uygunsuz içerik', status: 'open', createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(environment.authenticatedContext('user-3').firestore(), 'moderationReports', 'group-report-2'), {
    reporterUid: 'user-3', reportedUid: 'user-1', conversationType: 'group', conversationId: groupId,
    messageId: 'message-1', reason: 'Uygunsuz içerik', status: 'open', createdAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'reply-1'), {
    id: 'reply-1', senderUid: 'user-1', type: 'text', text: 'Yanıt',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: 'message-1', schemaVersion: 4,
  }));
  await assertSucceeds(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'not-a-reply'), {
    id: 'not-a-reply', senderUid: 'user-1', type: 'text', text: 'Yeni mesaj',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: null, schemaVersion: 4,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'missing-reply'), {
    id: 'missing-reply', senderUid: 'user-1', type: 'text', text: 'Olmayan mesaja yanıt',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: 'does-not-exist', schemaVersion: 4,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'self-reply'), {
    id: 'self-reply', senderUid: 'user-1', type: 'text', text: 'Kendine yanıt',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), replyToMessageId: 'self-reply', schemaVersion: 4,
  }));
  await assertSucceeds(getDocs(query(
    collection(memberDatabase, 'devreGroups', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(40),
  )));
  await assertFails(updateDoc(messageReference, { text: 'değiştirildi' }));
  await assertFails(deleteDoc(messageReference));

  const outsiderDatabase = environment.authenticatedContext('user-3').firestore();
  await assertFails(getDocs(collection(outsiderDatabase, 'devreGroups', groupId, 'messages')));
  await assertFails(setDoc(doc(outsiderDatabase, 'devreGroups', groupId, 'messages', 'outsider'), {
    id: 'outsider',
    senderUid: 'user-3',
    type: 'text',
    text: 'Yetkisiz',
    createdAt: serverTimestamp(),
    clientCreatedAt: Timestamp.now(),
    schemaVersion: 3,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'spoofed'), {
    id: 'spoofed',
    senderUid: 'user-2',
    type: 'text',
    text: 'Sahte gönderen',
    createdAt: serverTimestamp(),
    clientCreatedAt: Timestamp.now(),
    schemaVersion: 3,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'blank'), {
    id: 'blank',
    senderUid: 'user-1',
    type: 'text',
    text: '   ',
    createdAt: serverTimestamp(),
    clientCreatedAt: Timestamp.now(),
    schemaVersion: 3,
  }));
  await assertSucceeds(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'image-1'), {
    id: 'image-1', senderUid: 'user-1', type: 'image',
    mediaPath: `devreGroups/${groupId}/media/image-1/image.jpg`, caption: '', width: 1600, height: 900,
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
  await assertSucceeds(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'audio-1'), {
    id: 'audio-1', senderUid: 'user-1', type: 'audio',
    mediaPath: `devreGroups/${groupId}/media/audio-1/audio.m4a`, durationMillis: 17000,
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'bad-media'), {
    id: 'bad-media', senderUid: 'user-1', type: 'image', mediaPath: 'other/private.jpg', caption: '', width: 800, height: 600,
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'too-long'), {
    id: 'too-long', senderUid: 'user-1', type: 'text', text: 'a'.repeat(1501),
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
  await assertSucceeds(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'document-1'), {
    id: 'document-1', senderUid: 'user-1', type: 'document',
    mediaPath: `devreGroups/${groupId}/media/document-1/document`, fileName: 'Sevk_Belgesi.pdf',
    mimeType: 'application/pdf', sizeBytes: 2048, extension: 'pdf',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'bad-document'), {
    id: 'bad-document', senderUid: 'user-1', type: 'document',
    mediaPath: `devreGroups/${groupId}/media/bad-document/document`, fileName: 'virus.exe',
    mimeType: 'application/octet-stream', sizeBytes: 2048, extension: 'exe',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));
  await assertFails(setDoc(doc(memberDatabase, 'devreGroups', groupId, 'messages', 'oversized-document'), {
    id: 'oversized-document', senderUid: 'user-1', type: 'document',
    mediaPath: `devreGroups/${groupId}/media/oversized-document/document`, fileName: 'Buyuk.pdf',
    mimeType: 'application/pdf', sizeBytes: (20 * 1024 * 1024) + 1, extension: 'pdf',
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.now(), schemaVersion: 3,
  }));

  const messageSnapshot = await getDoc(messageReference);
  const messageCreatedAt = messageSnapshot.get('createdAt');
  const cursorReference = doc(memberDatabase, 'devreGroups', groupId, 'readCursors', 'user-1');
  await assertSucceeds(setDoc(cursorReference, {
    uid: 'user-1', lastReadMessageId: 'message-1', lastReadMessageCreatedAt: messageCreatedAt,
    lastReadAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('user-2').firestore(), 'devreGroups', groupId, 'readCursors', 'user-1')));
  await assertFails(getDoc(doc(outsiderDatabase, 'devreGroups', groupId, 'readCursors', 'user-1')));
  await assertFails(setDoc(doc(environment.authenticatedContext('user-2').firestore(), 'devreGroups', groupId, 'readCursors', 'user-1'), {
    uid: 'user-1', lastReadMessageId: 'message-1', lastReadMessageCreatedAt: messageCreatedAt,
    lastReadAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(cursorReference, {
    lastReadMessageCreatedAt: Timestamp.fromMillis(messageCreatedAt.toMillis() + 1),
    lastReadAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));

  const hiddenReference = doc(memberDatabase, 'users', 'user-1', 'hiddenGroupMessages', groupId, 'messages', 'message-1');
  await assertSucceeds(setDoc(hiddenReference, { groupId, messageId: 'message-1', hiddenAt: serverTimestamp() }));
  await assertSucceeds(getDoc(hiddenReference));
  await assertFails(getDoc(doc(environment.authenticatedContext('user-2').firestore(), 'users', 'user-1', 'hiddenGroupMessages', groupId, 'messages', 'message-1')));
  await assertFails(setDoc(doc(memberDatabase, 'users', 'user-1', 'hiddenGroupMessages', groupId, 'messages', 'message-spoof'), {
    groupId: 'another-group', messageId: 'message-spoof', hiddenAt: serverTimestamp(),
  }));

  await assertFails(updateDoc(doc(environment.authenticatedContext('user-2').firestore(), 'devreGroups', groupId, 'messages', 'message-1'), {
    deletedForEveryone: true, deletedAt: serverTimestamp(), deletedBy: 'user-2',
  }));
  await assertSucceeds(updateDoc(messageReference, {
    deletedForEveryone: true, deletedAt: serverTimestamp(), deletedBy: 'user-1',
  }));
  await assertFails(updateDoc(messageReference, { deletedAt: serverTimestamp() }));
});
