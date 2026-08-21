import { useEffect, useState } from 'react';

import { resolveProfilePhotoURL } from '@/services/firebase';

const profilePhotoURLCache = new Map<string, string | null>();

function photoCacheKey(uid: string, photoPath: string | null, versionTimestamp: number): string {
  return `${uid}|${photoPath ?? ''}|${versionTimestamp}`;
}

function cachePhotoURL(key: string, value: string | null): void {
  profilePhotoURLCache.set(key, value);
  if (profilePhotoURLCache.size > 128) {
    const oldestKey = profilePhotoURLCache.keys().next().value;
    if (typeof oldestKey === 'string') profilePhotoURLCache.delete(oldestKey);
  }
}

export function useProfilePhotoURL(
  uid: string,
  photoPath: string | null,
  version: Date | null,
): string | null {
  const versionTimestamp = version?.getTime() ?? 0;
  const cacheKey = photoCacheKey(uid, photoPath, versionTimestamp);
  const [photoURL, setPhotoURL] = useState<string | null>(() => profilePhotoURLCache.get(cacheKey) ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) {
      queueMicrotask(() => {
        if (!cancelled) {
          cachePhotoURL(cacheKey, null);
          setPhotoURL(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void resolveProfilePhotoURL(uid, photoPath, versionTimestamp)
      .then((url) => {
        if (!cancelled) {
          const separator = url?.includes('?') ? '&' : '?';
          const nextURL = url ? `${url}${separator}v=${versionTimestamp}` : null;
          cachePhotoURL(cacheKey, nextURL);
          setPhotoURL(nextURL);
        }
      })
      .catch(() => {
        if (!cancelled && !profilePhotoURLCache.has(cacheKey)) setPhotoURL(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, photoPath, uid, versionTimestamp]);

  return photoURL;
}
