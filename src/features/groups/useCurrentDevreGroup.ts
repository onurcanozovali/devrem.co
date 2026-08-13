import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { fetchCurrentDevreGroup } from '@/services/firebase';
import type { DevreGroupResult } from './types/groups';

export function useCurrentDevreGroup() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [result, setResult] = useState<DevreGroupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const identityVersion = profile
    ? `${profile.militaryPeriodYear}:${profile.militaryPeriodMonth}:${profile.militaryCity}:${profile.militaryType}:${profile.militaryUnit ?? ''}`
    : '';

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void fetchCurrentDevreGroup(session.userId).then((nextResult) => {
      if (!cancelled) { setResult(nextResult); setError(null); }
    }).catch(() => {
      if (!cancelled) setError('Devre grubun yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
    });
    return () => { cancelled = true; };
  }, [identityVersion, requestVersion, session]);

  const retry = useCallback(() => {
    setResult(null);
    setError(null);
    setRequestVersion((current) => current + 1);
  }, []);

  return { error, profile, result, retry, session, setResult };
}
