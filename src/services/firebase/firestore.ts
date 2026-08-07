import {
  Timestamp,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from '@react-native-firebase/firestore';

import { isProvinceCode } from '@/data/turkeyProvinces';
import { ProfileFlowError } from '@/features/profile/services/profileErrors';
import {
  isValidBirthYear,
  isValidMilitaryPeriod,
  isValidMilitaryUnit,
  isValidName,
  isValidStoredDate,
  normalizeWhitespace,
} from '@/features/profile/services/profileValidation';
import {
  militaryTypes,
  type CompleteUserProfileInput,
  type MilitaryPeriod,
  type MilitaryType,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
}

function readTimestamp(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function parseMilitaryPeriod(value: unknown): MilitaryPeriod | null {
  if (!isRecord(value)) return null;
  const { year, month } = value;
  if (typeof year !== 'number' || typeof month !== 'number' || !isValidMilitaryPeriod(year, month)) return null;
  return { year, month };
}

function assertValidProfileInput(input: CompleteUserProfileInput): void {
  if (
    !isValidName(input.firstName)
    || !isValidName(input.lastName)
    || !isValidBirthYear(input.birthYear)
    || !isProvinceCode(input.residenceCity)
    || !isProvinceCode(input.departureCity)
    || !isMilitaryType(input.militaryType)
    || !isValidMilitaryPeriod(input.militaryPeriod.year, input.militaryPeriod.month)
    || !isProvinceCode(input.militaryCity)
    || !isValidMilitaryUnit(input.militaryUnit)
    || !isValidStoredDate(input.reportingDate)
  ) throw new ProfileFlowError('malformed');
}

function parseCompleteProfile(uid: string, data: DocumentData): UserProfile {
  const militaryPeriod = parseMilitaryPeriod(data.militaryPeriod);
  const firstName = data.firstName;
  const lastName = data.lastName;
  const birthYear = data.birthYear;
  const militaryUnit = data.militaryUnit;
  if (
    data.uid !== uid
    || data.onboardingCompleted !== true
    || !isValidName(firstName)
    || !isValidName(lastName)
    || !isValidBirthYear(birthYear)
    || !isProvinceCode(data.residenceCity)
    || !isProvinceCode(data.departureCity)
    || !isMilitaryType(data.militaryType)
    || !militaryPeriod
    || !isProvinceCode(data.militaryCity)
    || !isValidMilitaryUnit(militaryUnit)
    || !isValidStoredDate(data.reportingDate)
  ) {
    throw new ProfileFlowError('malformed');
  }

  return {
    uid,
    firstName: normalizeWhitespace(firstName),
    lastName: normalizeWhitespace(lastName),
    birthYear,
    residenceCity: data.residenceCity,
    departureCity: data.departureCity,
    militaryType: data.militaryType,
    militaryPeriod,
    militaryCity: data.militaryCity,
    militaryUnit: normalizeWhitespace(militaryUnit),
    reportingDate: data.reportingDate,
    onboardingCompleted: true,
    createdAt: readTimestamp(data.createdAt),
    updatedAt: readTimestamp(data.updatedAt),
  };
}

export async function fetchUserProfile(uid: string): Promise<UserProfileSnapshot> {
  const snapshot = await getDoc(getUserProfileReference(uid));
  if (!snapshot.exists()) return { status: 'missing', profile: null };

  const data = snapshot.data();
  if (data.onboardingCompleted !== true) return { status: 'incomplete', profile: null };
  return { status: 'complete', profile: parseCompleteProfile(uid, data) };
}

export async function saveCompletedUserProfile(
  uid: string,
  input: CompleteUserProfileInput,
): Promise<UserProfile> {
  assertValidProfileInput(input);
  const database = getFirestoreDatabase();
  const profileReference = getUserProfileReference(uid);
  const normalizedInput: CompleteUserProfileInput = {
    ...input,
    firstName: normalizeWhitespace(input.firstName),
    lastName: normalizeWhitespace(input.lastName),
    militaryUnit: normalizeWhitespace(input.militaryUnit),
  };

  await runTransaction(database, async (transaction) => {
    const existingSnapshot = await transaction.get(profileReference);
    const commonData = {
      ...normalizedInput,
      uid,
      onboardingCompleted: true,
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
