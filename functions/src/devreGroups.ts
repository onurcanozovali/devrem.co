import { createHash } from 'node:crypto';

import { getDevreIdentityKey } from '@devrem/devre-domain';
import {
  FieldValue,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';

import type { PublicProfileProjection } from './publicProfile.js';

export type DevreGroupMembershipSource = 'live' | 'backfill' | 'development-seed';

interface CurrentGroupMembership {
  groupId: string;
  identityKey: string;
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
  return { groupId: value.groupId, identityKey: value.identityKey };
}

export function createDevreGroupId(profile: PublicProfileProjection): string | null {
  const identityKey = getDevreIdentityKey(profile);
  if (!identityKey) return null;
  const digest = createHash('sha256').update(identityKey).digest('hex');
  return `devre-v1-${digest}`;
}

export async function synchronizeDevreGroupMembership(
  database: Firestore,
  uid: string,
  source: DevreGroupMembershipSource,
): Promise<string | null> {
  const publicProfileReference = database.doc(`publicProfiles/${uid}`);
  const stateReference = database.doc(`_devreGroupMemberships/${uid}`);
  return database.runTransaction(async (transaction) => {
    const [profileSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(publicProfileReference),
      transaction.get(stateReference),
    ]);
    const profile = profileSnapshot.exists
      ? profileSnapshot.data() as PublicProfileProjection
      : null;
    const identityKey = getDevreIdentityKey(profile);
    const groupId = profile ? createDevreGroupId(profile) : null;
    const previous = stateSnapshot.exists ? parseCurrentMembership(stateSnapshot.data()) : null;
    const transition = decideDevreGroupMembershipTransition(previous?.groupId ?? null, groupId);

    if (!profile || !identityKey || !groupId) {
      if (transition.removeGroupId) transaction.delete(database.doc(`devreGroups/${transition.removeGroupId}/members/${uid}`));
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
      transaction.delete(database.doc(`devreGroups/${transition.removeGroupId}/members/${uid}`));
    }
    transaction.set(groupReference, {
      groupId,
      militaryPeriodYear: profile.militaryPeriodYear,
      militaryPeriodMonth: profile.militaryPeriodMonth,
      militaryCity: profile.militaryCity,
      militaryType: profile.militaryType,
      militaryUnitId: profile.militaryUnitId,
      militaryUnitName: profile.militaryUnitName,
      schemaVersion: 1,
      ...(groupSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(memberReference, {
      uid,
      schemaVersion: 1,
      source,
      ...(memberSnapshot.exists ? {} : { joinedAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(stateReference, {
      uid,
      groupId,
      identityKey,
      schemaVersion: 1,
      source,
      ...(stateSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return groupId;
  });
}

export async function deleteDevreGroupMembershipForUser(
  database: Firestore,
  uid: string,
): Promise<void> {
  const stateReference = database.doc(`_devreGroupMemberships/${uid}`);
  await database.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateReference);
    const membership = stateSnapshot.exists ? parseCurrentMembership(stateSnapshot.data()) : null;
    if (membership) transaction.delete(database.doc(`devreGroups/${membership.groupId}/members/${uid}`));
    transaction.delete(stateReference);
  });
}
