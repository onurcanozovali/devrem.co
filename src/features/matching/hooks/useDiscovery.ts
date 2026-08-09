import { useEffect, useMemo, useState } from 'react';

import type { UserProfile } from '@/features/profile/types/profile';
import { fetchPublicProfiles } from '@/services/firebase';
import { filterAndRankPublicProfiles } from '../services/discoveryDomain';
import { mapDiscoveryError } from '../services/discoveryErrors';
import type { DiscoveryFilters, DiscoveryReferenceProfile, PublicProfile } from '../types/discovery';

type DiscoveryStatus = 'loading' | 'ready' | 'error';

function createDefaultFilters(profile: UserProfile): DiscoveryFilters {
  return {
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryCity: profile.militaryCity,
    departureCity: profile.departureCity,
  };
}

export function useDiscovery(profile: UserProfile) {
  const [filters, setFiltersState] = useState<DiscoveryFilters>(() => createDefaultFilters(profile));
  const [candidates, setCandidates] = useState<PublicProfile[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const reference = useMemo<DiscoveryReferenceProfile>(() => ({
    userId: profile.uid,
    departureCity: profile.departureCity,
    militaryCity: profile.militaryCity,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryUnit: profile.militaryUnit,
  }), [profile]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicProfiles(filters)
      .then((profiles) => {
        if (cancelled) return;
        setCandidates(profiles);
        setError(null);
        setStatus('ready');
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return;
        setError(mapDiscoveryError(caughtError).message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [filters, requestVersion]);

  const profiles = useMemo(
    () => filterAndRankPublicProfiles(candidates, reference, filters),
    [candidates, filters, reference],
  );

  const setFilters = (nextFilters: DiscoveryFilters) => {
    setStatus('loading');
    setError(null);
    setFiltersState(nextFilters);
  };

  const retry = () => {
    setStatus('loading');
    setError(null);
    setRequestVersion((current) => current + 1);
  };

  return { error, filters, profiles, retry, setFilters, status };
}