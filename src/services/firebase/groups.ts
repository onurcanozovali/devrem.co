import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';

import { parsePublicProfileData } from '@/features/matching/services/discoveryDomain';
import { isProvinceCode } from '@/data/turkeyProvinces';
import { getMilitaryUnitById } from '@/features/militaryUnits/catalog';
import { forceCodes, type ForceCode } from '@/features/militaryUnits/types';
import type { PublicProfile } from '@/features/matching/types/discovery';
import type { DevreGroup, DevreGroupResult, DevreGroupSummary } from '@/features/groups/types/groups';
import { militaryTypes, type MilitaryType } from '@/features/profile/types/profile';
import { getFirebaseApp } from './app';

const groupMemberPageSize = 50;
const publicProfileBatchSize = 30;
const groupCacheLifetimeMillis = 15_000;

interface CachedGroup {
  expiresAt: number;
  group: DevreGroup;
}

export interface CurrentGroupMembership {
  groupId: string;
  kind: 'devre' | 'travel';
}

const groupCache = new Map<string, CachedGroup>();
const groupRequests = new Map<string, Promise<DevreGroup | null>>();
const groupSummaryCache = new Map<string, { expiresAt: number; group: DevreGroupSummary }>();
const groupSummaryRequests = new Map<string, Promise<DevreGroupSummary | null>>();

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
}

function isForceCode(value: unknown): value is ForceCode {
  return typeof value === 'string' && forceCodes.some((code) => code === value);
}

function parseGroupSummary(
  groupId: string,
  value: Record<string, unknown>,
): DevreGroupSummary | null {
  const kind = value.kind === 'travel' || groupId.startsWith('travel-v1-') ? 'travel' : 'devre';
  const departureCity = value.departureCity ?? null;
  if (
    value.groupId !== groupId
    || typeof value.militaryPeriodYear !== 'number'
    || typeof value.militaryPeriodMonth !== 'number'
    || !isProvinceCode(value.militaryCity)
    || !isMilitaryType(value.militaryType)
    || !(value.militaryUnitId === null || typeof value.militaryUnitId === 'string')
    || !(value.militaryUnitName === null || typeof value.militaryUnitName === 'string')
    || !(departureCity === null || isProvinceCode(departureCity))
  ) return null;
  const catalogForceCode = typeof value.militaryUnitId === 'string'
    ? getMilitaryUnitById(value.militaryUnitId)?.forceCode ?? null
    : null;
  const storedForceCode = value.forceCode ?? null;
  if (!(storedForceCode === null || isForceCode(storedForceCode))) return null;
  return {
    groupId,
    kind,
    departureCity,
    militaryPeriodYear: value.militaryPeriodYear,
    militaryPeriodMonth: value.militaryPeriodMonth,
    militaryCity: value.militaryCity,
    militaryType: value.militaryType,
    militaryUnitId: value.militaryUnitId,
    militaryUnitName: value.militaryUnitName,
    forceCode: catalogForceCode ?? storedForceCode,
    lastMessageAt: value.lastMessageAt instanceof Timestamp ? value.lastMessageAt.toDate() : null,
    lastMessagePreview: typeof value.lastMessagePreview === 'string' ? value.lastMessagePreview : null,
    lastMessageType: value.lastMessageType === 'text' || value.lastMessageType === 'image' || value.lastMessageType === 'audio' || value.lastMessageType === 'document'
      ? value.lastMessageType : null,
  };
}

function parseGroup(
  groupId: string,
  value: Record<string, unknown>,
  profiles: PublicProfile[],
  membershipStatusByUid: Readonly<Record<string, 'active' | 'left'>>,
): DevreGroup | null {
  const summary = parseGroupSummary(groupId, value);
  return summary ? {
    ...summary,
    members: profiles.filter((profile) => membershipStatusByUid[profile.userId] === 'active'),
    departedMembers: profiles.filter((profile) => membershipStatusByUid[profile.userId] === 'left'),
    membershipStatusByUid,
  } : null;
}

async function fetchGroupSummary(groupId: string): Promise<DevreGroupSummary | null> {
  const cached = groupSummaryCache.get(groupId);
  if (cached && cached.expiresAt > Date.now()) return cached.group;
  const pending = groupSummaryRequests.get(groupId);
  if (pending) return pending;
  const request = getDoc(doc(getFirestore(getFirebaseApp()), 'devreGroups', groupId)).then((snapshot) => {
    if (!snapshot.exists()) return null;
    const group = parseGroupSummary(snapshot.id, snapshot.data());
    if (!group) throw new Error('malformed-devre-group');
    groupSummaryCache.set(groupId, { group, expiresAt: Date.now() + groupCacheLifetimeMillis });
    return group;
  }).finally(() => groupSummaryRequests.delete(groupId));
  groupSummaryRequests.set(groupId, request);
  return request;
}

async function fetchGroup(groupId: string): Promise<DevreGroup | null> {
  const database = getFirestore(getFirebaseApp());
  const [groupSnapshot, membersSnapshot] = await Promise.all([
    getDoc(doc(database, 'devreGroups', groupId)),
    getDocs(query(collection(database, 'devreGroups', groupId, 'members'), limit(groupMemberPageSize))),
  ]);
  if (!groupSnapshot.exists()) return null;
  const membershipStatusByUid = Object.fromEntries(membersSnapshot.docs.map((memberSnapshot) => [
    memberSnapshot.id,
    memberSnapshot.get('status') === 'left' ? 'left' : 'active',
  ])) as Record<string, 'active' | 'left'>;
  const publicProfiles: PublicProfile[] = [];
  const memberIds = membersSnapshot.docs.map((memberSnapshot) => memberSnapshot.id);
  for (let index = 0; index < memberIds.length; index += publicProfileBatchSize) {
    const ids = memberIds.slice(index, index + publicProfileBatchSize);
    if (!ids.length) continue;
    const profilesSnapshot = await getDocs(query(
      collection(database, 'publicProfiles'),
      where(documentId(), 'in', ids),
    ));
    for (const publicSnapshot of profilesSnapshot.docs) {
      const data = publicSnapshot.data();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null;
      const parsed = parsePublicProfileData(publicSnapshot.id, { ...data, updatedAt });
      if (parsed) publicProfiles.push(parsed);
    }
  }
  const group = parseGroup(groupId, groupSnapshot.data(), publicProfiles, membershipStatusByUid);
  if (!group) throw new Error('malformed-devre-group');
  return group;
}

async function fetchCachedGroup(groupId: string): Promise<DevreGroup | null> {
  const cached = groupCache.get(groupId);
  if (cached && cached.expiresAt > Date.now()) return cached.group;
  const pending = groupRequests.get(groupId);
  if (pending) return pending;
  const request = fetchGroup(groupId).then((group) => {
    if (group) groupCache.set(groupId, { group, expiresAt: Date.now() + groupCacheLifetimeMillis });
    return group;
  }).finally(() => groupRequests.delete(groupId));
  groupRequests.set(groupId, request);
  return request;
}

function parseMembershipSnapshot(
  snapshot: { exists: () => boolean; get: (field: string) => unknown },
  kind: CurrentGroupMembership['kind'],
): CurrentGroupMembership | null {
  if (!snapshot.exists()) return null;
  const groupId = snapshot.get('groupId');
  return typeof groupId === 'string' && /^(devre|travel)-v1-[a-f0-9]{64}$/.test(groupId)
    ? { groupId, kind }
    : null;
}

async function fetchGroupByMembership(uid: string, membershipCollection: '_devreGroupMemberships' | '_travelGroupMemberships'): Promise<DevreGroupSummary | null> {
  const database = getFirestore(getFirebaseApp());
  const membershipSnapshot = await getDoc(doc(database, membershipCollection, uid));
  const membership = parseMembershipSnapshot(membershipSnapshot, membershipCollection === '_devreGroupMemberships' ? 'devre' : 'travel');
  return membership ? fetchGroupSummary(membership.groupId) : null;
}

export async function fetchCurrentDevreGroupSummaries(
  memberships: readonly CurrentGroupMembership[],
): Promise<DevreGroupSummary[]> {
  const groups = await Promise.all(memberships.map(({ groupId }) => fetchGroupSummary(groupId)));
  return groups.filter((group): group is DevreGroupSummary => group !== null);
}

export async function fetchCurrentDevreGroupById(
  groupId: string,
  memberships: readonly CurrentGroupMembership[],
): Promise<DevreGroup | null> {
  if (!/^(devre|travel)-v1-[a-f0-9]{64}$/.test(groupId)) return null;
  const isCurrent = memberships.some((membership) => membership.groupId === groupId);
  return isCurrent ? fetchCachedGroup(groupId) : null;
}

export function subscribeToCurrentGroupMemberships(
  uid: string,
  onChange: (memberships: readonly CurrentGroupMembership[]) => void,
  onError: () => void,
): () => void {
  const database = getFirestore(getFirebaseApp());
  const snapshots = new Map<CurrentGroupMembership['kind'], CurrentGroupMembership | null>();
  const sources = [
    { collectionName: '_devreGroupMemberships', kind: 'devre' },
    { collectionName: '_travelGroupMemberships', kind: 'travel' },
  ] as const;
  const unsubscribes = sources.map(({ collectionName, kind }) => onSnapshot(
    doc(database, collectionName, uid),
    (snapshot) => {
      snapshots.set(kind, snapshot ? parseMembershipSnapshot(snapshot, kind) : null);
      if (snapshots.size === sources.length) onChange([...snapshots.values()].filter((membership): membership is CurrentGroupMembership => membership !== null));
    },
    onError,
  ));
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

export async function fetchCurrentDevreGroup(uid: string): Promise<DevreGroupResult> {
  const database = getFirestore(getFirebaseApp());
  const group = await fetchGroupByMembership(uid, '_devreGroupMemberships');
  if (!group) return { status: 'pending', group: null, acknowledged: false };
  const stateSnapshot = await getDoc(doc(database, 'users', uid, 'devreGroupState', 'main'));
  return {
    status: 'ready',
    group,
    acknowledged: stateSnapshot.exists() && stateSnapshot.get('acknowledgedGroupId') === group.groupId,
  };
}

export async function acknowledgeDevreGroup(uid: string, groupId: string): Promise<void> {
  const database = getFirestore(getFirebaseApp());
  const reference = doc(database, 'users', uid, 'devreGroupState', 'main');
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    transaction.set(reference, {
      acknowledgedGroupId: groupId,
      createdAt: snapshot.exists() && snapshot.get('createdAt') instanceof Timestamp
        ? snapshot.get('createdAt')
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function fetchCommunicationPreference(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(
    getFirestore(getFirebaseApp()),
    'users', uid, 'communicationPreferences', 'main',
  ));
  return !snapshot.exists() || snapshot.get('allowDirectMessages') !== false;
}

export async function saveCommunicationPreference(uid: string, allowDirectMessages: boolean): Promise<void> {
  const database = getFirestore(getFirebaseApp());
  const reference = doc(database, 'users', uid, 'communicationPreferences', 'main');
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    transaction.set(reference, {
      allowDirectMessages,
      createdAt: snapshot.exists() && snapshot.get('createdAt') instanceof Timestamp
        ? snapshot.get('createdAt')
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
