import { useEffect, useMemo, useState } from 'react';

import type { UserProfile } from '@/features/profile/types/profile';
import { fetchPublicProfiles } from '@/services/firebase';
import {
  filterAndRankPublicProfiles,
  filterPublicProfilesBySegment,
  getDiscoverySegmentOptions,
} from '../services/discoveryDomain';
import { mapDiscoveryError } from '../services/discoveryErrors';
import type { DiscoveryQuery, DiscoveryReferenceProfile, DiscoverySegment, PublicProfile } from '../types/discovery';

type DiscoveryStatus = 'loading' | 'ready' | 'error';

export function useDiscovery(profile: UserProfile) {
  const [selectedSegment, setSelectedSegment] = useState<DiscoverySegment>('all');
  const [candidates, setCandidates] = useState<PublicProfile[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const reference = useMemo<DiscoveryReferenceProfile>(() => ({
    userId: profile.uid,
    residenceCity: profile.residenceCity,
    departureCity: profile.departureCity,
    militaryCity: profile.militaryCity,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryUnit: profile.militaryUnit,
  }), [
    profile.departureCity,
    profile.militaryCity,
    profile.militaryPeriodMonth,
    profile.militaryPeriodYear,
    profile.militaryUnit,
    profile.residenceCity,
    profile.uid,
  ]);
  const discoveryQuery = useMemo<DiscoveryQuery>(() => ({
    militaryCity: profile.militaryCity,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryPeriodYear: profile.militaryPeriodYear,
  }), [profile.militaryCity, profile.militaryPeriodMonth, profile.militaryPeriodYear]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicProfiles(discoveryQuery)
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
  }, [discoveryQuery, requestVersion]);

  const rankedProfiles = useMemo(
    () => filterAndRankPublicProfiles(candidates, reference),
    [candidates, reference],
  );
  const profiles = useMemo(
    () => filterPublicProfilesBySegment(rankedProfiles, reference, selectedSegment),
    [rankedProfiles, reference, selectedSegment],
  );
  const segments = useMemo(() => getDiscoverySegmentOptions(reference), [reference]);

  const retry = () => {
    setStatus('loading');
    setError(null);
    setRequestVersion((current) => current + 1);
  };

  return { error, profiles, reference, retry, segments, selectedSegment, setSelectedSegment, status };
}