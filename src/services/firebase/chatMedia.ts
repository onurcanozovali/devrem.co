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

export type ChatMediaKind = 'image' | 'audio';

export function getChatMediaPath(groupId: string, messageId: string, kind: ChatMediaKind): string {
  return `devreGroups/${groupId}/media/${messageId}/${kind === 'image' ? 'image.jpg' : 'audio.m4a'}`;
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
}): Promise<string> {
  const { groupId, kind, localUri, messageId, onProgress, senderUid } = input;
  const mediaPath = getChatMediaPath(groupId, messageId, kind);
  const task = putFile(getMediaReference(mediaPath), localUri, {
    cacheControl: 'private,max-age=86400',
    contentType: kind === 'image' ? 'image/jpeg' : 'audio/mp4',
    customMetadata: { kind, messageId, senderUid },
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

export async function resolveChatMediaLocalUri(
  groupId: string,
  messageId: string,
  kind: ChatMediaKind,
  mediaPath: string,
): Promise<string> {
  if (mediaPath !== getChatMediaPath(groupId, messageId, kind)) throw new Error('invalid-media-path');
  const file = new File(Paths.cache, `devrem-${groupId}-${messageId}-${kind}.${kind === 'image' ? 'jpg' : 'm4a'}`);
  if (!file.exists) await writeToFile(getMediaReference(mediaPath), file.uri);
  return file.uri;
}

export async function deleteChatMedia(mediaPath: string): Promise<void> {
  await deleteObject(getMediaReference(mediaPath)).catch(() => undefined);
}
