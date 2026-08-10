import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import { parsePublicProfileData } from '@/features/matching/services/discoveryDomain';
import { isProvinceCode } from '@/data/turkeyProvinces';
import type { PublicProfile } from '@/features/matching/types/discovery';
import type { DevreGroup, DevreGroupResult } from '@/features/groups/types/groups';
import { militaryTypes, type MilitaryType } from '@/features/profile/types/profile';
import { getFirebaseApp } from './app';

const groupMemberPageSize = 50;

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
}

function parseGroup(groupId: string, value: Record<string, unknown>, members: PublicProfile[]): DevreGroup | null {
  if (
    value.groupId !== groupId
    || typeof value.militaryPeriodYear !== 'number'
    || typeof value.militaryPeriodMonth !== 'number'
    || !isProvinceCode(value.militaryCity)
    || !isMilitaryType(value.militaryType)
    || !(value.militaryUnitId === null || typeof value.militaryUnitId === 'string')
    || !(value.militaryUnitName === null || typeof value.militaryUnitName === 'string')
  ) return null;
  return {
    groupId,
    militaryPeriodYear: value.militaryPeriodYear,
    militaryPeriodMonth: value.militaryPeriodMonth,
    militaryCity: value.militaryCity,
    militaryType: value.militaryType,
    militaryUnitId: value.militaryUnitId,
    militaryUnitName: value.militaryUnitName,
    members,
  };
}

export async function fetchCurrentDevreGroup(uid: string): Promise<DevreGroupResult> {
  const database = getFirestore(getFirebaseApp());
  const membershipSnapshot = await getDoc(doc(database, '_devreGroupMemberships', uid));
  if (!membershipSnapshot.exists()) return { status: 'pending', group: null, acknowledged: false };
  const groupId = membershipSnapshot.get('groupId');
  if (typeof groupId !== 'string' || !/^devre-v1-[a-f0-9]{64}$/.test(groupId)) {
    return { status: 'pending', group: null, acknowledged: false };
  }
  const [groupSnapshot, membersSnapshot, stateSnapshot] = await Promise.all([
    getDoc(doc(database, 'devreGroups', groupId)),
    getDocs(query(collection(database, 'devreGroups', groupId, 'members'), limit(groupMemberPageSize))),
    getDoc(doc(database, 'users', uid, 'devreGroupState', 'main')),
  ]);
  if (!groupSnapshot.exists()) return { status: 'pending', group: null, acknowledged: false };
  const publicProfiles = await Promise.all(membersSnapshot.docs.map(async (memberSnapshot) => {
    const publicSnapshot = await getDoc(doc(database, 'publicProfiles', memberSnapshot.id));
    if (!publicSnapshot.exists()) return null;
    const data = publicSnapshot.data();
    const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null;
    return parsePublicProfileData(publicSnapshot.id, { ...data, updatedAt });
  }));
  const group = parseGroup(groupId, groupSnapshot.data(), publicProfiles.filter((profile): profile is PublicProfile => profile !== null));
  if (!group) throw new Error('malformed-devre-group');
  return {
    status: 'ready',
    group,
    acknowledged: stateSnapshot.exists() && stateSnapshot.get('acknowledgedGroupId') === groupId,
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
