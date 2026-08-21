import { hasExactDevreIdentity } from '@devrem/devre-domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import {
  fetchCurrentDevreGroupSummaries,
  subscribeToCurrentGroupMemberships,
  type CurrentGroupMembership,
} from '@/services/firebase';
import type { DevreGroupResult, DevreGroupSummary } from './types/groups';

const groupSnapshotsByUid = new Map<string, readonly DevreGroupSummary[]>();

function derivePrimaryResult(groups: readonly DevreGroupSummary[]): DevreGroupResult {
  const primaryGroup = groups.find((group) => group.kind === 'devre');
  return primaryGroup
    ? { status: 'ready', group: primaryGroup, acknowledged: false }
    : { status: 'pending', group: null, acknowledged: false };
}

function belongsToCurrentProfile(group: DevreGroupSummary, profile: NonNullable<ReturnType<typeof useProfile>['profile']>): boolean {
  return hasExactDevreIdentity({
    militaryCity: profile.militaryCity,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryType: profile.militaryType,
    militaryUnitId: profile.militaryUnitId,
    militaryUnitName: profile.militaryUnitNameSnapshot ?? profile.militaryUnit,
  }, group) && (group.kind !== 'travel' || group.departureCity === profile.departureCity);
}

export function useCurrentDevreGroup() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [error, setError] = useState<string | null>(null);
  const cachedGroups = session ? groupSnapshotsByUid.get(session.userId) : undefined;
  const [result, setResultState] = useState<DevreGroupResult | null>(() => cachedGroups ? derivePrimaryResult(cachedGroups) : null);
  const [groups, setGroups] = useState<readonly DevreGroupSummary[]>(() => cachedGroups ?? []);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const requestVersion = useRef(0);

  const load = useCallback(async (memberships: readonly CurrentGroupMembership[]) => {
    if (!session || !profile) return;
    const version = ++requestVersion.current;
    try {
      const nextGroups = await fetchCurrentDevreGroupSummaries(memberships);
      if (version !== requestVersion.current) return;
      const currentGroups = nextGroups.filter((group) => belongsToCurrentProfile(group, profile));
      const currentPrimary = derivePrimaryResult(currentGroups);
      groupSnapshotsByUid.set(session.userId, currentGroups);
      setGroups(currentGroups);
      setResultState(currentPrimary);
      setError(null);
    } catch {
      if (version !== requestVersion.current) return;
      setError('Grupların yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
    }
  }, [profile, session]);

  useFocusEffect(useCallback(() => {
    if (!session || !profile) return undefined;
    if (__DEV__) console.debug('[perf] subscribe current group summaries', { subscriptionVersion });
    const unsubscribe = subscribeToCurrentGroupMemberships(
      session.userId,
      (memberships) => void load(memberships),
      () => setError('Grup üyeliğin takip edilemedi. Tekrar dene.'),
    );
    return () => {
      requestVersion.current += 1;
      unsubscribe();
      if (__DEV__) console.debug('[perf] unsubscribe current group summaries');
    };
  }, [load, profile, session, subscriptionVersion]));

  const retry = useCallback(() => {
    setError(null);
    setSubscriptionVersion((current) => current + 1);
  }, []);

  const setResult = useCallback((nextResult: DevreGroupResult) => {
    setResultState(nextResult);
    if (nextResult.status === 'ready') {
      setGroups((current) => {
        const nextGroups = current.map((group) => group.kind === 'devre' ? nextResult.group : group);
        if (session) groupSnapshotsByUid.set(session.userId, nextGroups);
        return nextGroups;
      });
    }
  }, [session]);

  const visibleGroups = profile ? groups.filter((group) => belongsToCurrentProfile(group, profile)) : [];
  const visibleResult = result?.status === 'ready' && profile && !belongsToCurrentProfile(result.group, profile)
    ? { status: 'pending', group: null, acknowledged: false } as const
    : result;
  return { error, groups: visibleGroups, profile, result: visibleResult, retry, session, setResult };
}
