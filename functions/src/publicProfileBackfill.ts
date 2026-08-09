import { FieldPath, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { synchronizePublicProfile } from './publicProfileSync.js';

const backfillPageSize = 400;
const synchronizationBatchSize = 20;

async function synchronizePage(database: Firestore, userIds: string[]): Promise<number> {
  let synchronizedCount = 0;
  for (let index = 0; index < userIds.length; index += synchronizationBatchSize) {
    const results = await Promise.all(
      userIds.slice(index, index + synchronizationBatchSize)
        .map((uid) => synchronizePublicProfile(database, uid)),
    );
    synchronizedCount += results.filter(Boolean).length;
  }
  return synchronizedCount;
}

export async function backfillPublicProfiles(database: Firestore): Promise<number> {
  let lastDocument: QueryDocumentSnapshot | null = null;
  let synchronizedCount = 0;

  while (true) {
    let profilesQuery = database.collection('users').orderBy(FieldPath.documentId()).limit(backfillPageSize);
    if (lastDocument) profilesQuery = profilesQuery.startAfter(lastDocument);
    const snapshot = await profilesQuery.get();
    if (snapshot.empty) return synchronizedCount;

    synchronizedCount += await synchronizePage(database, snapshot.docs.map(({ id }) => id));
    lastDocument = snapshot.docs.at(-1) ?? null;
    if (snapshot.size < backfillPageSize) return synchronizedCount;
  }
}