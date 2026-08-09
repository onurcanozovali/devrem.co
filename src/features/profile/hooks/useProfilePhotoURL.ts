import { useEffect, useState } from 'react';

import { resolveProfilePhotoURL } from '@/services/firebase';

export function useProfilePhotoURL(
  uid: string,
  photoPath: string | null,
  version: Date | null,
): string | null {
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const versionTimestamp = version?.getTime() ?? 0;

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) {
      queueMicrotask(() => {
        if (!cancelled) setPhotoURL(null);
      });
      return () => {
        cancelled = true;
      };
    }

    void resolveProfilePhotoURL(uid, photoPath, versionTimestamp)
      .then((url) => {
        if (!cancelled) {
          const separator = url?.includes('?') ? '&' : '?';
          setPhotoURL(url ? `${url}${separator}v=${versionTimestamp}` : null);
        }
      })
      .catch(() => {
        if (!cancelled) setPhotoURL(null);
      });

    return () => {
      cancelled = true;
    };
  }, [photoPath, uid, versionTimestamp]);

  return photoURL;
}