import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { createPublicProfileProjection } from './publicProfile.js';

export async function synchronizePublicProfile(database: Firestore, uid: string): Promise<boolean> {
  return database.runTransaction(async (transaction) => {
    const privateReference = database.doc(`users/${uid}`);
    const publicReference = database.doc(`publicProfiles/${uid}`);
    const privateSnapshot = await transaction.get(privateReference);
    const projection = createPublicProfileProjection(
      uid,
      privateSnapshot.exists ? privateSnapshot.data() : null,
    );
    if (!projection) {
      transaction.delete(publicReference);
      return false;
    }
    transaction.set(publicReference, { ...projection, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}