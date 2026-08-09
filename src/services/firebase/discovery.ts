import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from '@react-native-firebase/firestore';

import { parsePublicProfileData } from '@/features/matching/services/discoveryDomain';
import type { DiscoveryReferenceProfile, PublicProfile } from '@/features/matching/types/discovery';
import { getFirebaseApp } from './app';

export const discoveryPageSize = 40;

function parsePublicProfileSnapshot(
  userId: string,
  data: Record<string, unknown>,
): PublicProfile | null {
  const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null;
  return parsePublicProfileData(userId, { ...data, updatedAt });
}

export async function fetchPublicProfiles(reference: DiscoveryReferenceProfile): Promise<PublicProfile[]> {
  const database = getFirestore(getFirebaseApp());
  const snapshot = await getDocs(query(
    collection(database, 'publicProfiles'),
    where('militaryPeriodYear', '==', reference.militaryPeriodYear),
    where('militaryPeriodMonth', '==', reference.militaryPeriodMonth),
    where('militaryCity', '==', reference.militaryCity),
    limit(discoveryPageSize),
  ));
  return snapshot.docs.flatMap((documentSnapshot) => {
    const profile = parsePublicProfileSnapshot(documentSnapshot.id, documentSnapshot.data());
    return profile ? [profile] : [];
  });
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!userId) return null;
  const database = getFirestore(getFirebaseApp());
  const snapshot = await getDoc(doc(database, 'publicProfiles', userId));
  return snapshot.exists() ? parsePublicProfileSnapshot(snapshot.id, snapshot.data()) : null;
}