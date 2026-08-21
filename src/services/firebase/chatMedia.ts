import { File, Paths } from 'expo-file-system';
import {
  TaskEvent,
  deleteObject,
  getStorage,
  putFile,
  ref,
  writeToFile,
} from '@react-native-firebase/storage';

import { getFirebaseApp } from './app';

export type ChatMediaKind = 'image' | 'audio' | 'document';

export function getChatMediaPath(groupId: string, messageId: string, kind: ChatMediaKind): string {
  const fileName = kind === 'image' ? 'image.jpg' : kind === 'audio' ? 'audio.m4a' : 'document';
  return `devreGroups/${groupId}/media/${messageId}/${fileName}`;
}

export function getDirectChatMediaPath(conversationId: string, messageId: string, kind: Exclude<ChatMediaKind, 'audio'>): string {
  return `directConversations/${conversationId}/media/${messageId}/${kind === 'image' ? 'image.jpg' : 'document'}`;
}

function getMediaReference(path: string) {
  return ref(getStorage(getFirebaseApp()), path);
}

export async function uploadChatMedia(input: {
  groupId: string;
  kind: ChatMediaKind;
  localUri: string;
  messageId: string;
  onProgress?: (progress: number) => void;
  senderUid: string;
  document?: { extension: string; fileName: string; mimeType: string };
}): Promise<string> {
  const { document, groupId, kind, localUri, messageId, onProgress, senderUid } = input;
  const mediaPath = getChatMediaPath(groupId, messageId, kind);
  const task = putFile(getMediaReference(mediaPath), localUri, {
    cacheControl: 'private,max-age=86400',
    contentType: kind === 'image' ? 'image/jpeg' : kind === 'audio' ? 'audio/mp4' : document?.mimeType,
    customMetadata: {
      kind, messageId, senderUid,
      ...(kind === 'document' && document ? { extension: document.extension, fileName: document.fileName } : {}),
    },
  });
  const unsubscribe = task.on(TaskEvent.STATE_CHANGED, (snapshot) => {
    if (snapshot.totalBytes > 0) onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
  });
  try {
    await task;
    onProgress?.(1);
    return mediaPath;
  } finally {
    unsubscribe();
  }
}

export async function uploadDirectChatMedia(input: {
  conversationId: string;
  kind: 'image' | 'document';
  localUri: string;
  messageId: string;
  senderUid: string;
  document?: { extension: string; fileName: string; mimeType: string };
}): Promise<string> {
  const { conversationId, document, kind, localUri, messageId, senderUid } = input;
  const mediaPath = getDirectChatMediaPath(conversationId, messageId, kind);
  await putFile(getMediaReference(mediaPath), localUri, {
    cacheControl: 'private,max-age=86400',
    contentType: kind === 'image' ? 'image/jpeg' : document?.mimeType,
    customMetadata: {
      kind, messageId, senderUid,
      ...(kind === 'document' && document ? { extension: document.extension, fileName: document.fileName } : {}),
    },
  });
  return mediaPath;
}

export async function resolveChatMediaLocalUri(
  groupId: string,
  messageId: string,
  kind: ChatMediaKind,
  mediaPath: string,
  extension?: string,
): Promise<string> {
  if (mediaPath !== getChatMediaPath(groupId, messageId, kind)) throw new Error('invalid-media-path');
  const suffix = kind === 'image' ? 'jpg' : kind === 'audio' ? 'm4a' : extension ?? 'bin';
  const file = new File(Paths.cache, `devrem-${groupId}-${messageId}-${kind}.${suffix}`);
  if (!file.exists) await writeToFile(getMediaReference(mediaPath), file.uri);
  return file.uri;
}

export async function resolveDirectChatMediaLocalUri(
  conversationId: string,
  messageId: string,
  kind: 'image' | 'document',
  mediaPath: string,
  extension?: string,
): Promise<string> {
  if (mediaPath !== getDirectChatMediaPath(conversationId, messageId, kind)) throw new Error('invalid-media-path');
  const file = new File(Paths.cache, `devrem-direct-${conversationId}-${messageId}.${kind === 'image' ? 'jpg' : extension ?? 'bin'}`);
  if (!file.exists) await writeToFile(getMediaReference(mediaPath), file.uri);
  return file.uri;
}

export async function deleteChatMedia(mediaPath: string): Promise<void> {
  await deleteObject(getMediaReference(mediaPath)).catch(() => undefined);
}
