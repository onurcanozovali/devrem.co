import {
  Timestamp,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from '@react-native-firebase/firestore';

import { ProfileFlowError } from '@/features/profile/services/profileErrors';
import {
  parseCompletedProfileData,
  serializeCompletedProfileData,
  serializeUpdatedProfileData,
} from '@/features/profile/services/profileSerialization';
import {
  type CompleteUserProfileInput,
  type UserProfile,
  type UserProfileSnapshot,
} from '@/features/profile/types/profile';
import { getFirebaseApp } from './app';

function getFirestoreDatabase() {
  return getFirestore(getFirebaseApp());
}

function getUserProfileReference(uid: string) {
  return doc(getFirestoreDatabase(), 'users', uid);
}

function readTimestamp(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function parseCompleteProfile(uid: string, data: DocumentData): UserProfile | null {
  const parsed = parseCompletedProfileData(uid, data);
  if (!parsed) return null;
  return {
    ...parsed,
    createdAt: readTimestamp(data.createdAt),
    updatedAt: readTimestamp(data.updatedAt),
  };
}

export async function fetchUserProfile(uid: string): Promise<UserProfileSnapshot> {
  const snapshot = await getDoc(getUserProfileReference(uid));
  if (!snapshot.exists()) return { status: 'missing', profile: null };

  const data = snapshot.data();
  if (data.onboardingCompleted !== true) return { status: 'incomplete', profile: null };
  const profile = parseCompleteProfile(uid, data);
  return profile
    ? { status: 'complete', profile }
    : { status: 'incomplete', profile: null };
}

export async function saveCompletedUserProfile(
  uid: string,
  input: CompleteUserProfileInput,
): Promise<UserProfile> {
  const normalizedInput = serializeCompletedProfileData(uid, input);
  if (!normalizedInput) throw new ProfileFlowError('malformed');
  const database = getFirestoreDatabase();
  const profileReference = getUserProfileReference(uid);

  await runTransaction(database, async (transaction) => {
    const existingSnapshot = await transaction.get(profileReference);
    const commonData = {
      ...normalizedInput,
      updatedAt: serverTimestamp(),
    };

    if (existingSnapshot.exists()) {
      const existingCreatedAt = existingSnapshot.get('createdAt');
      transaction.set(
        profileReference,
        {
          ...commonData,
          createdAt: existingCreatedAt instanceof Timestamp ? existingCreatedAt : serverTimestamp(),
        },
      );
      return;
    }

    transaction.set(profileReference, { ...commonData, createdAt: serverTimestamp() });
  });

  const savedProfile = await fetchUserProfile(uid);
  if (savedProfile.status !== 'complete') throw new ProfileFlowError('unknown');
  return savedProfile.profile;
}

export async function updateUserProfile(
  uid: string,
  input: CompleteUserProfileInput,
): Promise<UserProfile> {
  const database = getFirestoreDatabase();
  const profileReference = getUserProfileReference(uid);

  await runTransaction(database, async (transaction) => {
    const existingSnapshot = await transaction.get(profileReference);
    if (!existingSnapshot.exists()) throw new ProfileFlowError('malformed');

    const existingProfile = parseCompleteProfile(uid, existingSnapshot.data());
    if (!existingProfile) throw new ProfileFlowError('malformed');
    const normalizedInput = serializeUpdatedProfileData(uid, input, existingProfile);
    if (!normalizedInput) throw new ProfileFlowError('malformed');

    transaction.set(profileReference, {
      ...normalizedInput,
      createdAt: existingSnapshot.get('createdAt'),
      updatedAt: serverTimestamp(),
    });
  });

  const savedProfile = await fetchUserProfile(uid);
  if (savedProfile.status !== 'complete') throw new ProfileFlowError('unknown');
  return savedProfile.profile;
}
