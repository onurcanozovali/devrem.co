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

const MAX_CACHED_PHOTO_URLS = 100;
const photoURLCache = new Map<string, Promise<string | null>>();

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

function invalidatePhotoURL(photoPath: string): void {
  const prefix = `${photoPath}:`;
  for (const key of photoURLCache.keys()) {
    if (key.startsWith(prefix)) photoURLCache.delete(key);
  }
}

export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const photoPath = getProfilePhotoPath(uid);
  invalidatePhotoURL(photoPath);
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
    return photoPath;
  } finally {
    unsubscribe();
  }
}

export function resolveProfilePhotoURL(
  uid: string,
  photoPath: string,
  version = 0,
): Promise<string | null> {
  if (photoPath !== getProfilePhotoPath(uid)) return Promise.resolve(null);
  const cacheKey = `${photoPath}:${version}`;
  const cachedURL = photoURLCache.get(cacheKey);
  if (cachedURL) return cachedURL;

  const request = getDownloadURL(ref(getFirebaseStorage(), photoPath))
    .catch((error: unknown) => {
      if (isObjectMissing(error)) return null;
      photoURLCache.delete(cacheKey);
      throw error;
    });
  if (photoURLCache.size >= MAX_CACHED_PHOTO_URLS) {
    const oldestKey = photoURLCache.keys().next().value;
    if (oldestKey !== undefined) photoURLCache.delete(oldestKey);
  }
  photoURLCache.set(cacheKey, request);
  return request;
}

export async function deleteProfilePhoto(uid: string): Promise<void> {
  const photoPath = getProfilePhotoPath(uid);
  try {
    await deleteObject(getPhotoReference(uid));
  } catch (error: unknown) {
    if (!isObjectMissing(error)) throw error;
  } finally {
    invalidatePhotoURL(photoPath);
  }
}