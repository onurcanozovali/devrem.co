/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import test, { after, before, beforeEach } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const projectId = 'devrem-storage-rules-test';
const avatarPath = 'users/user-1/profile/avatar.jpg';
const jpegMetadata = { contentType: 'image/jpeg' };
let environment: RulesTestEnvironment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    storage: { rules: await readFile('storage.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearStorage();
});

after(async () => {
  await environment.cleanup();
});

test('owner may upload, replace, and delete the deterministic JPEG avatar', async () => {
  const avatar = ref(environment.authenticatedContext('user-1').storage(), avatarPath);
  await assertSucceeds(uploadBytes(avatar, new Uint8Array([1, 2, 3]), jpegMetadata));
  await assertSucceeds(uploadBytes(avatar, new Uint8Array([4, 5, 6]), jpegMetadata));
  await assertSucceeds(deleteObject(avatar));
});

test('authenticated users may read the narrow avatar path but unauthenticated users may not', async () => {
  const ownerAvatar = ref(environment.authenticatedContext('user-1').storage(), avatarPath);
  await uploadBytes(ownerAvatar, new Uint8Array([1, 2, 3]), jpegMetadata);

  const otherUserAvatar = ref(environment.authenticatedContext('user-2').storage(), avatarPath);
  await assertSucceeds(getBytes(otherUserAvatar));

  const unauthenticatedAvatar = ref(environment.unauthenticatedContext().storage(), avatarPath);
  await assertFails(getBytes(unauthenticatedAvatar));
});

test('another user cannot write or delete an owner avatar', async () => {
  const ownerAvatar = ref(environment.authenticatedContext('user-1').storage(), avatarPath);
  await uploadBytes(ownerAvatar, new Uint8Array([1, 2, 3]), jpegMetadata);

  const otherUserAvatar = ref(environment.authenticatedContext('user-2').storage(), avatarPath);
  await assertFails(uploadBytes(otherUserAvatar, new Uint8Array([4]), jpegMetadata));
  await assertFails(deleteObject(otherUserAvatar));
});

test('non-JPEG, oversized, and arbitrary-path writes are denied', async () => {
  const ownerStorage = environment.authenticatedContext('user-1').storage();
  await assertFails(uploadBytes(
    ref(ownerStorage, avatarPath),
    new Uint8Array([1, 2, 3]),
    { contentType: 'image/png' },
  ));
  await assertFails(uploadBytes(
    ref(ownerStorage, avatarPath),
    new Uint8Array(1024 * 1024 + 1),
    jpegMetadata,
  ));
  await assertFails(uploadBytes(
    ref(ownerStorage, 'users/user-1/private/document.jpg'),
    new Uint8Array([1, 2, 3]),
    jpegMetadata,
  ));
});