import {
  TaskEvent,
  deleteObject,
  getDownloadURL,
  getStorage,
  putFile,
  ref,
} from '@react-native-firebase/storage';

import { getProfilePhotoPath } from '@/features/profile/services/profilePhotoDomain';
import { getFirebaseApp } from './app';

function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}

function getPhotoReference(uid: string) {
  return ref(getFirebaseStorage(), getProfilePhotoPath(uid));
}

function isObjectMissing(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'storage/object-not-found';
}

export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const task = putFile(getPhotoReference(uid), localUri, {
    cacheControl: 'private,max-age=3600',
    contentType: 'image/jpeg',
  });
  const unsubscribe = task.on(TaskEvent.STATE_CHANGED, (snapshot) => {
    if (snapshot.totalBytes > 0) onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
  });

  try {
    await task;
    onProgress?.(1);
    return getProfilePhotoPath(uid);
  } finally {
    unsubscribe();
  }
}

export async function resolveProfilePhotoURL(uid: string, photoPath: string): Promise<string | null> {
  if (photoPath !== getProfilePhotoPath(uid)) return null;
  try {
    return await getDownloadURL(ref(getFirebaseStorage(), photoPath));
  } catch (error: unknown) {
    if (isObjectMissing(error)) return null;
    throw error;
  }
}

export async function deleteProfilePhoto(uid: string): Promise<void> {
  try {
    await deleteObject(getPhotoReference(uid));
  } catch (error: unknown) {
    if (!isObjectMissing(error)) throw error;
  }
}