import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { fetchUserProfile, saveCompletedUserProfile } from '@/services/firebase';
import { mapProfileError, ProfileFlowError } from './services/profileErrors';
import type { CompleteUserProfileInput, ProfileStatus, UserProfile } from './types/profile';

interface ProfileContextValue {
  status: ProfileStatus;
  profile: UserProfile | null;
  error: string | null;
  refreshProfile: () => Promise<void>;
  completeOnboarding: (input: CompleteUserProfileInput) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const { status: authStatus, session } = useAuth();
  const [status, setStatus] = useState<ProfileStatus>('idle');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refreshProfile = useCallback(async () => {
    if (authStatus !== 'authenticated' || !session) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setError(null);

    try {
      const result = await fetchUserProfile(session.userId);
      if (requestId !== requestIdRef.current) return;
      setProfile(result.profile);
      setStatus(result.status);
    } catch (caughtError: unknown) {
      if (requestId !== requestIdRef.current) return;
      const profileError = mapProfileError(caughtError);
      setProfile(null);
      setError(profileError.message);
      setStatus('error');
    }
  }, [authStatus, session]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !session) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refreshProfile();
    });
    return () => {
      cancelled = true;
      requestIdRef.current += 1;
    };
  }, [authStatus, refreshProfile, session]);

  const completeOnboarding = useCallback(async (input: CompleteUserProfileInput) => {
    if (authStatus !== 'authenticated' || !session) {
      throw new ProfileFlowError('permission-denied');
    }

    try {
      const savedProfile = await saveCompletedUserProfile(session.userId, input);
      setProfile(savedProfile);
      setError(null);
      setStatus('complete');
    } catch (caughtError: unknown) {
      throw mapProfileError(caughtError);
    }
  }, [authStatus, session]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      status: authStatus === 'authenticated' ? status : 'idle',
      profile: authStatus === 'authenticated' ? profile : null,
      error: authStatus === 'authenticated' ? error : null,
      refreshProfile,
      completeOnboarding,
    }),
    [authStatus, completeOnboarding, error, profile, refreshProfile, status],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
