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
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const projectId = 'devrem-storage-rules-test';
const avatarPath = 'users/user-1/profile/avatar.jpg';
const jpegMetadata = { contentType: 'image/jpeg' };
const groupId = `devre-v1-${'a'.repeat(64)}`;
const chatImagePath = `devreGroups/${groupId}/media/message-1/image.jpg`;
const chatImageMetadata = {
  contentType: 'image/jpeg',
  customMetadata: { kind: 'image', messageId: 'message-1', senderUid: 'user-1' },
};
const chatAudioPath = `devreGroups/${groupId}/media/message-2/audio.m4a`;
const chatAudioMetadata = {
  contentType: 'audio/mp4',
  customMetadata: { kind: 'audio', messageId: 'message-2', senderUid: 'user-1' },
};
const chatDocumentPath = `devreGroups/${groupId}/media/message-3/document`;
const chatDocumentMetadata = {
  contentType: 'application/pdf',
  customMetadata: {
    extension: 'pdf', fileName: 'Sevk_Belgesi.pdf', kind: 'document',
    messageId: 'message-3', senderUid: 'user-1',
  },
};
const directConversationId = `direct-v1-${'d'.repeat(64)}`;
const directImagePath = `directConversations/${directConversationId}/media/direct-image/image.jpg`;
const directImageMetadata = { contentType: 'image/jpeg', customMetadata: { kind: 'image', messageId: 'direct-image', senderUid: 'user-1' } };
const directDocumentPath = `directConversations/${directConversationId}/media/direct-document/document`;
const directDocumentMetadata = { contentType: 'application/pdf', customMetadata: { extension: 'pdf', fileName: 'Belge.pdf', kind: 'document', messageId: 'direct-document', senderUid: 'user-1' } };
let environment: RulesTestEnvironment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
    storage: { rules: await readFile('storage.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearStorage();
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    for (const uid of ['user-1', 'user-2']) {
      await setDoc(doc(context.firestore(), 'devreGroups', groupId, 'members', uid), { uid });
    }
    await setDoc(doc(context.firestore(), 'directConversations', directConversationId), {
      conversationId: directConversationId, participantUids: ['user-1', 'user-2'], type: 'direct',
    });
  });
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

test('only active group members may upload and read private chat images', async () => {
  const ownerImage = ref(environment.authenticatedContext('user-1').storage(), chatImagePath);
  await assertSucceeds(uploadBytes(ownerImage, new Uint8Array([1, 2, 3]), chatImageMetadata));
  await assertSucceeds(getBytes(ref(environment.authenticatedContext('user-2').storage(), chatImagePath)));
  await assertFails(getBytes(ref(environment.authenticatedContext('user-3').storage(), chatImagePath)));
  await assertFails(uploadBytes(
    ref(environment.authenticatedContext('user-3').storage(), chatImagePath),
    new Uint8Array([4]),
    { ...chatImageMetadata, customMetadata: { ...chatImageMetadata.customMetadata, senderUid: 'user-3' } },
  ));
});

test('departed members cannot read or write historical group media', async () => {
  const ownerImage = ref(environment.authenticatedContext('user-1').storage(), chatImagePath);
  await uploadBytes(ownerImage, new Uint8Array([1, 2, 3]), chatImageMetadata);
  await environment.withSecurityRulesDisabled(async (context) => setDoc(
    doc(context.firestore(), 'devreGroups', groupId, 'members', 'user-2'),
    { status: 'left' },
    { merge: true },
  ));
  const departedImage = ref(environment.authenticatedContext('user-2').storage(), chatImagePath);
  await assertFails(getBytes(departedImage));
  await assertFails(uploadBytes(
    departedImage,
    new Uint8Array([4]),
    { ...chatImageMetadata, customMetadata: { ...chatImageMetadata.customMetadata, senderUid: 'user-2' } },
  ));
});

test('chat media rejects spoofed metadata, video, arbitrary paths, and cross-user mutation', async () => {
  const owner = environment.authenticatedContext('user-1').storage();
  const ownerImage = ref(owner, chatImagePath);
  await assertFails(uploadBytes(ownerImage, new Uint8Array([1]), {
    ...chatImageMetadata,
    customMetadata: { ...chatImageMetadata.customMetadata, senderUid: 'user-2' },
  }));
  await assertFails(uploadBytes(ref(owner, `devreGroups/${groupId}/media/message-1/video.mp4`), new Uint8Array([1]), { contentType: 'video/mp4' }));
  await assertSucceeds(uploadBytes(ownerImage, new Uint8Array([1]), chatImageMetadata));
  await assertFails(uploadBytes(
    ref(environment.authenticatedContext('user-2').storage(), chatImagePath),
    new Uint8Array([2]),
    { ...chatImageMetadata, customMetadata: { ...chatImageMetadata.customMetadata, senderUid: 'user-2' } },
  ));
  await assertFails(deleteObject(ref(environment.authenticatedContext('user-2').storage(), chatImagePath)));
});

test('only active members may upload and read bounded chat audio', async () => {
  const ownerAudio = ref(environment.authenticatedContext('user-1').storage(), chatAudioPath);
  await assertSucceeds(uploadBytes(ownerAudio, new Uint8Array([1, 2, 3]), chatAudioMetadata));
  await assertSucceeds(getBytes(ref(environment.authenticatedContext('user-2').storage(), chatAudioPath)));
  await assertFails(getBytes(ref(environment.authenticatedContext('user-3').storage(), chatAudioPath)));
  await assertFails(uploadBytes(ref(environment.authenticatedContext('user-1').storage(), chatAudioPath), new Uint8Array([1]), {
    ...chatAudioMetadata,
    contentType: 'video/mp4',
  }));
  await assertFails(uploadBytes(ref(environment.authenticatedContext('user-1').storage(), chatAudioPath), new Uint8Array([1]), {
    ...chatAudioMetadata,
    customMetadata: { ...chatAudioMetadata.customMetadata, messageId: 'wrong-id' },
  }));
});

test('documents are private, bounded, and restricted to approved MIME-extension pairs', async () => {
  const owner = environment.authenticatedContext('user-1').storage();
  const document = ref(owner, chatDocumentPath);
  await assertSucceeds(uploadBytes(document, new Uint8Array([1, 2, 3]), chatDocumentMetadata));
  await assertSucceeds(getBytes(ref(environment.authenticatedContext('user-2').storage(), chatDocumentPath)));
  await assertFails(getBytes(ref(environment.authenticatedContext('user-3').storage(), chatDocumentPath)));
  await assertFails(uploadBytes(document, new Uint8Array([1]), {
    ...chatDocumentMetadata,
    contentType: 'application/octet-stream',
  }));
  await assertFails(uploadBytes(document, new Uint8Array([1]), {
    ...chatDocumentMetadata,
    customMetadata: { ...chatDocumentMetadata.customMetadata, extension: 'exe' },
  }));
  await assertFails(uploadBytes(ref(owner, `devreGroups/${groupId}/media/message-3/archive.zip`), new Uint8Array([1]), {
    contentType: 'application/zip',
  }));
});

test('direct media is participant-only and validates sender plus document MIME metadata', async () => {
  const first = environment.authenticatedContext('user-1').storage();
  await assertSucceeds(uploadBytes(ref(first, directImagePath), new Uint8Array([1]), directImageMetadata));
  await assertSucceeds(getBytes(ref(environment.authenticatedContext('user-2').storage(), directImagePath)));
  await assertFails(getBytes(ref(environment.authenticatedContext('user-3').storage(), directImagePath)));
  await assertFails(uploadBytes(ref(environment.authenticatedContext('user-2').storage(), directImagePath), new Uint8Array([2]), {
    ...directImageMetadata, customMetadata: { ...directImageMetadata.customMetadata, senderUid: 'user-2' },
  }));
  await assertSucceeds(uploadBytes(ref(first, directDocumentPath), new Uint8Array([1]), directDocumentMetadata));
  await assertFails(uploadBytes(ref(first, directDocumentPath), new Uint8Array([1]), { ...directDocumentMetadata, contentType: 'application/octet-stream' }));
  await assertFails(uploadBytes(ref(first, directDocumentPath), new Uint8Array([1]), {
    ...directDocumentMetadata, customMetadata: { ...directDocumentMetadata.customMetadata, extension: 'exe' },
  }));
  await environment.withSecurityRulesDisabled(async (context) => setDoc(
    doc(context.firestore(), 'users', 'user-2', 'blockedUsers', 'user-1'),
    { blockedUid: 'user-1', createdAt: serverTimestamp() },
  ));
  await assertFails(uploadBytes(ref(first, `directConversations/${directConversationId}/media/blocked/image.jpg`), new Uint8Array([1]), {
    contentType: 'image/jpeg', customMetadata: { kind: 'image', messageId: 'blocked', senderUid: 'user-1' },
  }));
});
