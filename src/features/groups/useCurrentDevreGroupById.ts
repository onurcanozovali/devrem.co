import { hasExactDevreIdentity } from '@devrem/devre-domain';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import {
  fetchCurrentDevreGroupById,
  subscribeToCurrentGroupMemberships,
  type CurrentGroupMembership,
} from '@/services/firebase';
import type { DevreGroup } from './types/groups';

function belongsToProfile(group: DevreGroup, profile: NonNullable<ReturnType<typeof useProfile>['profile']>) {
  return hasExactDevreIdentity({
    militaryCity: profile.militaryCity,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryType: profile.militaryType,
    militaryUnitId: profile.militaryUnitId,
    militaryUnitName: profile.militaryUnitNameSnapshot ?? profile.militaryUnit,
  }, group) && (group.kind !== 'travel' || group.departureCity === profile.departureCity);
}

export function useCurrentDevreGroupById(groupId: string) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [group, setGroup] = useState<DevreGroup | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const membershipsRef = useRef<readonly CurrentGroupMembership[]>([]);
  const requestVersion = useRef(0);

  const load = useCallback(async (memberships: readonly CurrentGroupMembership[]) => {
    if (!session || !profile || !groupId) return;
    const version = ++requestVersion.current;
    try {
      const nextGroup = await fetchCurrentDevreGroupById(groupId, memberships);
      if (version !== requestVersion.current) return;
      setGroup(nextGroup && belongsToProfile(nextGroup, profile) ? nextGroup : null);
      setError(null);
    } catch {
      if (version !== requestVersion.current) return;
      setError('Sohbet açılamadı. İnternet bağlantını kontrol edip tekrar dene.');
    }
  }, [groupId, profile, session]);

  useEffect(() => {
    if (!session || !profile || !groupId) return undefined;
    const unsubscribe = subscribeToCurrentGroupMemberships(session.userId, (memberships) => {
      membershipsRef.current = memberships;
      void load(memberships);
    }, () => setError('Grup üyeliğin takip edilemedi. Tekrar dene.'));
    return () => {
      requestVersion.current += 1;
      unsubscribe();
    };
  }, [groupId, load, profile, session, subscriptionVersion]);

  const retry = useCallback(() => {
    setError(null);
    if (membershipsRef.current.length) void load(membershipsRef.current);
    else setSubscriptionVersion((current) => current + 1);
  }, [load]);

  return { error, group, retry, session };
}
