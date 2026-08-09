import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp } from 'firebase-admin/app';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { deleteAccountData, getProfilePhotoPath, isAuthUserMissing } from './accountDeletion.js';

initializeApp();

const recentAuthenticationWindowSeconds = 5 * 60;

function readBearerToken(authorizationHeader: string | undefined): string | null {
  const match = authorizationHeader?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

export const deleteAccount = onRequest(
  {
    cors: false,
    memory: '256MiB',
    region: 'europe-west1',
    timeoutSeconds: 120,
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ code: 'method-not-allowed' });
      return;
    }

    const idToken = readBearerToken(request.header('Authorization'));
    if (!idToken) {
      response.status(401).json({ code: 'unauthenticated' });
      return;
    }

    let uid: string;
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken, true);
      const authenticatedAt = decodedToken.auth_time;
      const currentTime = Math.floor(Date.now() / 1000);
      if (
        typeof authenticatedAt !== 'number'
        || currentTime - authenticatedAt > recentAuthenticationWindowSeconds
      ) {
        response.status(401).json({ code: 'recent-auth-required' });
        return;
      }
      uid = decodedToken.uid;
    } catch (error: unknown) {
      logger.warn('Account deletion rejected an invalid authentication token.', { error });
      response.status(401).json({ code: 'unauthenticated' });
      return;
    }

    try {
      await deleteAccountData(uid, {
        deleteAvatar: async (userId) => {
          await getStorage().bucket().file(getProfilePhotoPath(userId)).delete({ ignoreNotFound: true });
        },
        deleteProfile: async (userId) => {
          const database = getFirestore();
          await database.recursiveDelete(database.doc(`users/${userId}`));
        },
        deleteAuthUser: async (userId) => getAuth().deleteUser(userId),
        isAuthUserMissing,
      });

      response.status(200).json({ deleted: true });
    } catch (error: unknown) {
      logger.error('Account deletion failed and can be retried.', { uid, error });
      response.status(500).json({ code: 'deletion-failed' });
    }
  },
);
