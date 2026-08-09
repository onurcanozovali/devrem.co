/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'devrem-rules-test';
let environment: RulesTestEnvironment;

function profileData(uid: string, year: number, month: number) {
  return {
    uid,
    firstName: 'Onur',
    lastName: 'Özovalı',
    birthYear: 2000,
    residenceCity: 34,
    departureCity: 34,
    militaryCity: 6,
    militaryType: 'standard',
    militaryPeriodYear: year,
    militaryPeriodMonth: month,
    militaryUnit: null,
    reportingDate: `${year}-${String(month).padStart(2, '0')}-10`,
    onboardingCompleted: true,
    createdAt: Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
  };
}

async function seedProfile(uid: string, year: number, month: number) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), profileData(uid, year, month));
  });
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await environment.cleanup();
});

test('owner may update profile with a current or future period', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  const nextYear = new Date().getFullYear() + 1;
  await assertSucceeds(updateDoc(reference, {
    militaryPeriodYear: nextYear,
    militaryPeriodMonth: 1,
    reportingDate: `${nextYear}-01-10`,
    updatedAt: serverTimestamp(),
  }));
});

test('owner may edit another field while preserving the exact historical period', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertSucceeds(updateDoc(reference, { firstName: 'Onur Can', updatedAt: serverTimestamp() }));
});

test('owner cannot change a historical profile to a different past period', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertFails(updateDoc(reference, {
    militaryPeriodMonth: 8,
    reportingDate: '2025-08-10',
    updatedAt: serverTimestamp(),
  }));
});

test('users cannot update another profile or delete their own profile directly', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const otherUserReference = doc(environment.authenticatedContext('user-2').firestore(), 'users', 'user-1');
  await assertFails(updateDoc(otherUserReference, { firstName: 'Başka', updatedAt: serverTimestamp() }));

  const ownerReference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertFails(deleteDoc(ownerReference));
  assert.ok(true);
});

test('owner may set only their deterministic optional profile photo path', async () => {
  await environment.clearFirestore();
  await seedProfile('user-1', 2025, 7);
  const reference = doc(environment.authenticatedContext('user-1').firestore(), 'users', 'user-1');
  await assertSucceeds(updateDoc(reference, {
    photoPath: 'users/user-1/profile/avatar.jpg',
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(reference, {
    photoPath: 'users/user-2/profile/avatar.jpg',
    updatedAt: serverTimestamp(),
  }));
});