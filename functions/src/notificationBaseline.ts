import {
  FieldPath,
  FieldValue,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import {
  decideMembershipTransition,
  getMembershipFingerprint,
  type MembershipState,
} from './discoveryNotificationDomain.js';
import type { PublicProfileProjection } from './publicProfile.js';

const baselinePageSize = 400;
const baselineConcurrency = 20;

function parseMembershipState(value: DocumentData | undefined): MembershipState | null {
  if (
    typeof value?.active !== 'boolean'
    || !(value.fingerprint === null || typeof value.fingerprint === 'string')
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

async function baselineProfile(database: Firestore, uid: string): Promise<boolean> {
  const profileReference = database.doc(`publicProfiles/${uid}`);
  const membershipReference = database.doc(`_notificationMemberships/${uid}`);
  return database.runTransaction(async (transaction) => {
    const [profileSnapshot, membershipSnapshot] = await Promise.all([
      transaction.get(profileReference),
      transaction.get(membershipReference),
    ]);
    if (!profileSnapshot.exists) return false;
    const fingerprint = getMembershipFingerprint(
      profileSnapshot.data() as PublicProfileProjection,
    );
    if (!fingerprint) return false;
    const transition = decideMembershipTransition({
      beforeFingerprint: fingerprint,
      nextFingerprint: fingerprint,
      previousState: membershipSnapshot.exists
        ? parseMembershipState(membershipSnapshot.data())
        : null,
      notificationsEnabled: false,
      sourceEventId: null,
      source: 'baseline',
    });
    transaction.set(membershipReference, {
      uid,
      ...transition.nextState,
      ...(membershipSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

export async function baselineDiscoveryNotificationMemberships(database: Firestore): Promise<number> {
  const controlReference = database.doc('_notificationControl/discovery');
  await controlReference.set({ enabled: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const seedMarker = await database.doc('_developmentSeeds/discovery').get();
  const seededIdsValue = seedMarker.exists ? seedMarker.get('seededIds') : null;
  const seededIds = new Set(
    Array.isArray(seededIdsValue)
      ? seededIdsValue.filter((value): value is string => typeof value === 'string')
      : [],
  );
  let lastDocument: QueryDocumentSnapshot | null = null;
  let baselineCount = 0;

  while (true) {
    let profilesQuery = database.collection('publicProfiles')
      .orderBy(FieldPath.documentId())
      .limit(baselinePageSize);
    if (lastDocument) profilesQuery = profilesQuery.startAfter(lastDocument);
    const snapshot = await profilesQuery.get();
    if (snapshot.empty) break;
    const userIds = snapshot.docs
      .map((documentSnapshot) => documentSnapshot.id)
      .filter((uid) => !seededIds.has(uid));
    for (let index = 0; index < userIds.length; index += baselineConcurrency) {
      const results = await Promise.all(
        userIds.slice(index, index + baselineConcurrency)
          .map((uid) => baselineProfile(database, uid)),
      );
      baselineCount += results.filter(Boolean).length;
    }
    lastDocument = snapshot.docs.at(-1) ?? null;
    if (snapshot.size < baselinePageSize) break;
  }

  await controlReference.set({
    enabled: true,
    baselineCompletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return baselineCount;
}