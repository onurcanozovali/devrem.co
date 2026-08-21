import { createHash } from 'node:crypto';

import { getDevreIdentityKey } from '@devrem/devre-domain';
import {
  FieldValue,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';

import type { PublicProfileProjection } from './publicProfile.js';

export type DevreGroupMembershipSource = 'live' | 'backfill' | 'development-seed';
export type DevreGroupKind = 'devre' | 'travel';

interface CurrentGroupMembership {
  groupId: string;
  identityKey: string;
  membershipVersion: number;
}

export function decideDevreGroupMembershipTransition(
  previousGroupId: string | null,
  nextGroupId: string | null,
): { ensureGroupId: string | null; removeGroupId: string | null } {
  return {
    ensureGroupId: nextGroupId,
    removeGroupId: previousGroupId && previousGroupId !== nextGroupId ? previousGroupId : null,
  };
}

function parseCurrentMembership(value: DocumentData | undefined): CurrentGroupMembership | null {
  if (typeof value?.groupId !== 'string' || typeof value.identityKey !== 'string') return null;
  return {
    groupId: value.groupId,
    identityKey: value.identityKey,
    membershipVersion: Number.isInteger(value.membershipVersion) && value.membershipVersion > 0
      ? value.membershipVersion
      : 1,
  };
}

export function createDevreGroupId(profile: PublicProfileProjection): string | null {
  const identityKey = getDevreIdentityKey(profile);
  if (!identityKey) return null;
  const digest = createHash('sha256').update(identityKey).digest('hex');
  return `devre-v1-${digest}`;
}

export function createTravelGroupId(profile: PublicProfileProjection): string | null {
  const identityKey = getTravelGroupIdentityKey(profile);
  if (!identityKey) return null;
  const digest = createHash('sha256').update(identityKey).digest('hex');
  return `travel-v1-${digest}`;
}

export function getTravelGroupIdentityKey(profile: PublicProfileProjection | null): string | null {
  const devreIdentityKey = getDevreIdentityKey(profile);
  if (!profile || !devreIdentityKey || !Number.isInteger(profile.departureCity)) return null;
  return JSON.stringify([1, 'travel', devreIdentityKey, profile.departureCity]);
}

export function createDevreGroupDocument(
  profile: PublicProfileProjection,
  groupId: string,
  kind: DevreGroupKind,
): DocumentData {
  return {
    groupId,
    kind,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryCity: profile.militaryCity,
    militaryType: profile.militaryType,
    militaryUnitId: profile.militaryUnitId ?? null,
    militaryUnitName: profile.militaryUnitName ?? null,
    forceCode: profile.forceCode ?? null,
    ...(kind === 'travel' ? { departureCity: profile.departureCity } : {}),
    schemaVersion: 2,
  };
}

async function synchronizeSingleGroupMembership(input: {
  database: Firestore;
  kind: DevreGroupKind;
  source: DevreGroupMembershipSource;
  stateCollection: '_devreGroupMemberships' | '_travelGroupMemberships';
  uid: string;
}): Promise<string | null> {
  const { database, kind, source, stateCollection, uid } = input;
  const publicProfileReference = database.doc(`publicProfiles/${uid}`);
  const stateReference = database.doc(`${stateCollection}/${uid}`);
  return database.runTransaction(async (transaction) => {
    const [profileSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(publicProfileReference),
      transaction.get(stateReference),
    ]);
    const profile = profileSnapshot.exists ? profileSnapshot.data() as PublicProfileProjection : null;
    const identityKey = kind === 'travel' ? getTravelGroupIdentityKey(profile) : getDevreIdentityKey(profile);
    const groupId = profile
      ? kind === 'travel' ? createTravelGroupId(profile) : createDevreGroupId(profile)
      : null;
    const previous = stateSnapshot.exists ? parseCurrentMembership(stateSnapshot.data()) : null;
    const transition = decideDevreGroupMembershipTransition(previous?.groupId ?? null, groupId);
    const identityChanged = previous?.groupId !== groupId;
    const membershipVersion = previous
      ? previous.membershipVersion + (identityChanged ? 1 : 0)
      : 1;
    if (!profile || !identityKey || !groupId) {
      if (transition.removeGroupId) {
        transaction.set(database.doc(`devreGroups/${transition.removeGroupId}/members/${uid}`), {
          status: 'left',
          leftAt: FieldValue.serverTimestamp(),
          reason: 'profile_change',
          membershipVersion,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        const leaveEventId = `membership-v${membershipVersion}-${uid}-left`;
        transaction.set(database.doc(`devreGroups/${transition.removeGroupId}/groupEvents/${leaveEventId}`), {
          eventId: leaveEventId,
          type: 'membership.left',
          uid,
          displayName: profile?.firstName ?? 'Bir üye',
          membershipVersion,
          createdAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
        });
        if (kind === 'devre') {
          const historyId = `v${membershipVersion.toString().padStart(8, '0')}`;
          transaction.set(database.doc(`users/${uid}/assignmentHistory/${historyId}`), {
            revisionId: historyId,
            previousGroupId: previous?.groupId ?? null,
            currentGroupId: null,
            previousDevreIdentity: previous?.identityKey ?? null,
            newDevreIdentity: null,
            membershipVersion,
            reason: 'profile_change',
            changedAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          });
        }
      }
      transaction.delete(stateReference);
      return null;
    }
    const groupReference = database.doc(`devreGroups/${groupId}`);
    const memberReference = database.doc(`devreGroups/${groupId}/members/${uid}`);
    const [groupSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(groupReference),
      transaction.get(memberReference),
    ]);
    if (transition.removeGroupId) {
      transaction.set(database.doc(`devreGroups/${transition.removeGroupId}/members/${uid}`), {
        status: 'left',
        leftAt: FieldValue.serverTimestamp(),
        reason: 'profile_change',
        membershipVersion,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      const leaveEventId = `membership-v${membershipVersion}-${uid}-left`;
      transaction.set(database.doc(`devreGroups/${transition.removeGroupId}/groupEvents/${leaveEventId}`), {
        eventId: leaveEventId,
        type: 'membership.left',
        uid,
        displayName: profile.firstName,
        membershipVersion,
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
    }
    transaction.set(groupReference, {
      ...createDevreGroupDocument(profile, groupId, kind),
      ...(groupSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(memberReference, {
      uid,
      status: 'active',
      leftAt: null,
      reason: previous ? 'profile_change' : 'initial_assignment',
      membershipVersion,
      militaryUnitIdSnapshot: profile.militaryUnitId ?? null,
      militaryPeriodMonthSnapshot: profile.militaryPeriodMonth,
      militaryPeriodYearSnapshot: profile.militaryPeriodYear,
      militaryTypeSnapshot: profile.militaryType,
      schemaVersion: 2,
      source,
      ...(memberSnapshot.exists ? {} : { joinedAt: FieldValue.serverTimestamp() }),
      ...(identityChanged ? { lastJoinedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (identityChanged) {
      const joinEventId = `membership-v${membershipVersion}-${uid}-joined`;
      transaction.set(database.doc(`devreGroups/${groupId}/groupEvents/${joinEventId}`), {
        eventId: joinEventId,
        type: 'membership.joined',
        uid,
        displayName: profile.firstName,
        membershipVersion,
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
    }
    transaction.set(stateReference, {
      uid,
      groupId,
      identityKey,
      membershipVersion,
      schemaVersion: 2,
      source,
      ...(stateSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (kind === 'devre' && identityChanged) {
      const historyId = `v${membershipVersion.toString().padStart(8, '0')}`;
      transaction.set(database.doc(`users/${uid}/assignmentHistory/${historyId}`), {
        revisionId: historyId,
        previousGroupId: previous?.groupId ?? null,
        currentGroupId: groupId,
        previousDevreIdentity: previous?.identityKey ?? null,
        newDevreIdentity: identityKey,
        membershipVersion,
        reason: previous ? 'profile_change' : 'initial_assignment',
        changedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
    }
    return groupId;
  });
}

export async function synchronizeDevreGroupMembership(
  database: Firestore,
  uid: string,
  source: DevreGroupMembershipSource,
): Promise<string | null> {
  const primaryGroupId = await synchronizeSingleGroupMembership({
    database, kind: 'devre', source,
    stateCollection: '_devreGroupMemberships', uid,
  });
  await synchronizeSingleGroupMembership({
    database, kind: 'travel', source,
    stateCollection: '_travelGroupMemberships', uid,
  });
  return primaryGroupId;
}

export async function deleteDevreGroupMembershipForUser(
  database: Firestore,
  uid: string,
): Promise<void> {
  for (const collectionName of ['_devreGroupMemberships', '_travelGroupMemberships'] as const) {
    const stateReference = database.doc(`${collectionName}/${uid}`);
    await database.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateReference);
      const membership = stateSnapshot.exists ? parseCurrentMembership(stateSnapshot.data()) : null;
      if (membership) {
        const membershipVersion = membership.membershipVersion + 1;
        transaction.set(database.doc(`devreGroups/${membership.groupId}/members/${uid}`), {
          status: 'left',
          leftAt: FieldValue.serverTimestamp(),
          reason: 'account_deleted',
          membershipVersion,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        const leaveEventId = `membership-v${membershipVersion}-${uid}-left`;
        transaction.set(database.doc(`devreGroups/${membership.groupId}/groupEvents/${leaveEventId}`), {
          eventId: leaveEventId,
          type: 'membership.left',
          uid,
          displayName: 'Bir üye',
          membershipVersion,
          createdAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
        });
      }
      transaction.delete(stateReference);
    });
  }
}
