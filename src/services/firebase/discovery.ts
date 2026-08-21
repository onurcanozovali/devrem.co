import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from '@react-native-firebase/firestore';

import { parsePublicProfileData } from '@/features/matching/services/discoveryDomain';
import {
  DISCOVERY_PAGE_SIZE,
  createDiscoveryPageRequest,
  hasMoreDiscoveryPages,
} from '@/features/matching/services/discoveryPagination';
import type { DiscoveryQuery, PublicProfile } from '@/features/matching/types/discovery';
import { getFirebaseApp } from './app';

export const discoveryPageSize = DISCOVERY_PAGE_SIZE;
export type DiscoveryCursor = string;

export interface DiscoveryPage {
  cursor: DiscoveryCursor | null;
  hasMore: boolean;
  profiles: PublicProfile[];
}

const publicProfileCacheLifetimeMillis = 5 * 60 * 1000;
const publicProfileCache = new Map<string, { expiresAt: number; profile: PublicProfile }>();

function rememberPublicProfile(profile: PublicProfile): PublicProfile {
  publicProfileCache.set(profile.userId, {
    expiresAt: Date.now() + publicProfileCacheLifetimeMillis,
    profile,
  });
  return profile;
}

function parsePublicProfileSnapshot(
  userId: string,
  data: Record<string, unknown>,
): PublicProfile | null {
  const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null;
  return parsePublicProfileData(userId, { ...data, updatedAt });
}

export async function fetchPublicProfilesPage(
  reference: DiscoveryQuery,
  cursor: DiscoveryCursor | null = null,
): Promise<DiscoveryPage> {
  const pageRequest = createDiscoveryPageRequest(cursor);
  const database = getFirestore(getFirebaseApp());
  const publicProfiles = collection(database, 'publicProfiles');
  const baseConstraints = [
    where('militaryPeriodYear', '==', reference.militaryPeriodYear),
    where('militaryPeriodMonth', '==', reference.militaryPeriodMonth),
    where('militaryCity', '==', reference.militaryCity),
    where('militaryType', '==', reference.militaryType),
    ...(reference.militaryUnitId
      ? [where('militaryUnitId', '==', reference.militaryUnitId)]
      : []),
    orderBy(documentId()),
    ...(pageRequest.cursor ? [startAfter(pageRequest.cursor)] : []),
    limit(pageRequest.limit),
  ];
  const snapshot = await getDocs(query(publicProfiles, ...baseConstraints));
  const profiles = snapshot.docs.flatMap((documentSnapshot) => {
    const profile = parsePublicProfileSnapshot(documentSnapshot.id, documentSnapshot.data());
    return profile ? [rememberPublicProfile(profile)] : [];
  });
  return {
    cursor: snapshot.docs.at(-1)?.id ?? null,
    hasMore: hasMoreDiscoveryPages(snapshot.size),
    profiles,
  };
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!userId) return null;
  const cached = publicProfileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;
  const database = getFirestore(getFirebaseApp());
  const snapshot = await getDoc(doc(database, 'publicProfiles', userId));
  if (!snapshot.exists()) {
    publicProfileCache.delete(userId);
    return null;
  }
  const profile = parsePublicProfileSnapshot(snapshot.id, snapshot.data());
  return profile ? rememberPublicProfile(profile) : null;
}
