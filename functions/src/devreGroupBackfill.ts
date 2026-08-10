import { FieldPath, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { synchronizeDevreGroupMembership } from './devreGroups.js';
import type { DevreGroupMembershipSource } from './devreGroups.js';

const pageSize = 400;
const concurrency = 20;

type MembershipSynchronizer = (
  database: Firestore,
  uid: string,
  source: DevreGroupMembershipSource,
) => Promise<string | null>;

export async function backfillDevreGroups(
  database: Firestore,
  synchronizeMembership: MembershipSynchronizer = synchronizeDevreGroupMembership,
): Promise<number> {
  const seedMarker = await database.doc('_developmentSeeds/discovery').get();
  const seedValue = seedMarker.exists ? seedMarker.get('seededIds') : null;
  const seedIds = new Set(Array.isArray(seedValue)
    ? seedValue.filter((value): value is string => typeof value === 'string')
    : []);
  let lastDocument: QueryDocumentSnapshot | null = null;
  let membershipCount = 0;
  while (true) {
    let profilesQuery = database.collection('publicProfiles').orderBy(FieldPath.documentId()).limit(pageSize);
    if (lastDocument) profilesQuery = profilesQuery.startAfter(lastDocument);
    const snapshot = await profilesQuery.get();
    if (snapshot.empty) return membershipCount;
    for (let index = 0; index < snapshot.docs.length; index += concurrency) {
      const results = await Promise.all(snapshot.docs.slice(index, index + concurrency).map((documentSnapshot) => (
        synchronizeMembership(
          database,
          documentSnapshot.id,
          seedIds.has(documentSnapshot.id) ? 'development-seed' : 'backfill',
        )
      )));
      membershipCount += results.filter(Boolean).length;
    }
    lastDocument = snapshot.docs.at(-1) ?? null;
    if (snapshot.size < pageSize) return membershipCount;
  }
}
