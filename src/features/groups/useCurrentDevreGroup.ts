import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { fetchCurrentDevreGroup } from '@/services/firebase';
import type { DevreGroupResult } from './types/groups';

interface CachedGroupState {
  key: string;
  result: DevreGroupResult | null;
}

const resultCache = new Map<string, DevreGroupResult>();
const requestCache = new Map<string, Promise<DevreGroupResult>>();

function fetchCachedCurrentDevreGroup(key: string, uid: string): Promise<DevreGroupResult> {
  const cached = resultCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = requestCache.get(key);
  if (pending) return pending;
  const request = fetchCurrentDevreGroup(uid).then((result) => {
    resultCache.set(key, result);
    requestCache.delete(key);
    return result;
  }, (error: unknown) => {
    requestCache.delete(key);
    throw error;
  });
  requestCache.set(key, request);
  return request;
}

export function useCurrentDevreGroup() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const identityVersion = profile
    ? `${profile.militaryPeriodYear}:${profile.militaryPeriodMonth}:${profile.militaryCity}:${profile.militaryType}:${profile.militaryUnit ?? ''}`
    : '';
  const cacheKey = session && profile ? `${session.userId}:${identityVersion}` : '';
  const [state, setState] = useState<CachedGroupState>(() => ({
    key: cacheKey,
    result: cacheKey ? resultCache.get(cacheKey) ?? null : null,
  }));
  const result = state.key === cacheKey ? state.result : resultCache.get(cacheKey) ?? null;

  useEffect(() => {
    if (!session || !cacheKey) return;
    let cancelled = false;
    void fetchCachedCurrentDevreGroup(cacheKey, session.userId).then((nextResult) => {
      if (!cancelled) { setState({ key: cacheKey, result: nextResult }); setError(null); }
    }).catch(() => {
      if (!cancelled) setError('Devre grubun yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
    });
    return () => { cancelled = true; };
  }, [cacheKey, requestVersion, session]);

  const retry = useCallback(() => {
    resultCache.delete(cacheKey);
    requestCache.delete(cacheKey);
    setState({ key: cacheKey, result: null });
    setError(null);
    setRequestVersion((current) => current + 1);
  }, [cacheKey]);

  const setResult = useCallback((nextResult: DevreGroupResult) => {
    if (cacheKey) resultCache.set(cacheKey, nextResult);
    setState({ key: cacheKey, result: nextResult });
  }, [cacheKey]);

  return { error, profile, result, retry, session, setResult };
}
