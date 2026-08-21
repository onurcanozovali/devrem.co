import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserProfile } from '@/features/profile/types/profile';
import {
  fetchPublicProfilesPage,
  subscribeToBlockedUserIds,
  type DiscoveryCursor,
} from '@/services/firebase';
import {
  filterAndRankPublicProfiles,
  filterPublicProfilesBySegment,
  getDiscoverySegmentOptions,
} from '../services/discoveryDomain';
import { mapDiscoveryError } from '../services/discoveryErrors';
import {
  appendUniqueDiscoveryPage,
  canLoadNextDiscoveryPage,
  excludeBlockedDiscoveryProfiles,
  getDiscoveryQueryKey,
} from '../services/discoveryPagination';
import type { DiscoveryQuery, DiscoveryReferenceProfile, DiscoverySegment, PublicProfile } from '../types/discovery';

type DiscoveryStatus = 'loading' | 'ready' | 'error';

interface CachedDiscoveryPages {
  cursor: DiscoveryCursor | null;
  expiresAt: number;
  hasMore: boolean;
  pages: readonly (readonly PublicProfile[])[];
}

const discoveryCacheLifetimeMillis = 5 * 60 * 1000;
const discoveryPagesByQuery = new Map<string, CachedDiscoveryPages>();

function getCachedDiscoveryPages(queryKey: string): CachedDiscoveryPages | null {
  const cached = discoveryPagesByQuery.get(queryKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    discoveryPagesByQuery.delete(queryKey);
    return null;
  }
  return cached;
}

export function useDiscovery(profile: UserProfile) {
  const [selectedSegment, setSelectedSegment] = useState<DiscoverySegment>('all');
  const reference = useMemo<DiscoveryReferenceProfile>(() => ({
    userId: profile.uid,
    residenceCity: profile.residenceCity,
    departureCity: profile.departureCity,
    militaryCity: profile.militaryCity,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryType: profile.militaryType,
    militaryUnitId: profile.militaryUnitId,
    militaryUnitName: profile.militaryUnitNameSnapshot,
    forceCode: profile.forceCode,
  }), [
    profile.departureCity,
    profile.militaryCity,
    profile.militaryPeriodMonth,
    profile.militaryPeriodYear,
    profile.militaryType,
    profile.militaryUnitId,
    profile.militaryUnitNameSnapshot,
    profile.forceCode,
    profile.residenceCity,
    profile.uid,
  ]);
  const discoveryQuery = useMemo<DiscoveryQuery>(() => ({
    militaryCity: profile.militaryCity,
    militaryPeriodMonth: profile.militaryPeriodMonth,
    militaryPeriodYear: profile.militaryPeriodYear,
    militaryType: profile.militaryType,
    militaryUnitId: profile.militaryUnitId,
  }), [
    profile.militaryCity,
    profile.militaryPeriodMonth,
    profile.militaryPeriodYear,
    profile.militaryType,
    profile.militaryUnitId,
  ]);
  const queryKey = useMemo(() => getDiscoveryQueryKey(discoveryQuery), [discoveryQuery]);
  const initialCache = useMemo(() => getCachedDiscoveryPages(queryKey), [queryKey]);
  const [pages, setPages] = useState<readonly (readonly PublicProfile[])[]>(initialCache?.pages ?? []);
  const [loadedQueryKey, setLoadedQueryKey] = useState(initialCache ? queryKey : '');
  const [status, setStatus] = useState<DiscoveryStatus>(initialCache ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialCache?.hasMore ?? true);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<ReadonlySet<string>>(new Set());
  const activeRequestVersion = useRef(0);
  const pagesRef = useRef<readonly (readonly PublicProfile[])[]>(initialCache?.pages ?? []);
  const cursorRef = useRef<DiscoveryCursor | null>(initialCache?.cursor ?? null);
  const hasMoreRef = useRef(initialCache?.hasMore ?? true);
  const loadingMoreRef = useRef(false);

  const rememberPages = useCallback((
    nextPages: readonly (readonly PublicProfile[])[],
    cursor: DiscoveryCursor | null,
    hasMore: boolean,
  ) => {
    discoveryPagesByQuery.set(queryKey, {
      cursor,
      expiresAt: Date.now() + discoveryCacheLifetimeMillis,
      hasMore,
      pages: nextPages,
    });
  }, [queryKey]);

  useEffect(() => {
    const version = ++activeRequestVersion.current;
    loadingMoreRef.current = false;
    if (__DEV__) console.debug('[perf] load discovery first page', { requestVersion });
    void Promise.resolve().then(() => {
      if (version !== activeRequestVersion.current) return;
      const cached = getCachedDiscoveryPages(queryKey);
      setIsLoadingMore(false);
      setLoadMoreError(null);
      if (cached) {
        pagesRef.current = cached.pages;
        cursorRef.current = cached.cursor;
        hasMoreRef.current = cached.hasMore;
        setPages(cached.pages);
        setHasMore(cached.hasMore);
        setLoadedQueryKey(queryKey);
        setError(null);
        setStatus('ready');
        return;
      }

      pagesRef.current = [];
      cursorRef.current = null;
      hasMoreRef.current = true;
      setPages([]);
      setHasMore(true);
      setLoadedQueryKey('');
      setError(null);
      setStatus('loading');
      void fetchPublicProfilesPage(discoveryQuery).then((page) => {
        if (version !== activeRequestVersion.current) return;
        const nextPages = appendUniqueDiscoveryPage([], page.profiles);
        pagesRef.current = nextPages;
        cursorRef.current = page.cursor;
        hasMoreRef.current = page.hasMore;
        setPages(nextPages);
        setHasMore(page.hasMore);
        setLoadedQueryKey(queryKey);
        setError(null);
        setStatus('ready');
        rememberPages(nextPages, page.cursor, page.hasMore);
      })
      .catch((caughtError: unknown) => {
        if (version !== activeRequestVersion.current) return;
        setError(mapDiscoveryError(caughtError).message);
        setStatus('error');
      });
    });
    return () => { activeRequestVersion.current += 1; };
  }, [discoveryQuery, queryKey, rememberPages, requestVersion]);

  useFocusEffect(useCallback(() => {
    if (__DEV__) console.debug('[perf] subscribe discovery blockedUsers');
    const unsubscribe = subscribeToBlockedUserIds(profile.uid, setBlockedUserIds);
    return () => {
      unsubscribe();
      if (__DEV__) console.debug('[perf] unsubscribe discovery blockedUsers');
    };
  }, [profile.uid]));

  const loadMore = useCallback(async () => {
    if (!canLoadNextDiscoveryPage({ hasMore: hasMoreRef.current, isLoading: loadingMoreRef.current })) return;
    const cursor = cursorRef.current;
    if (!cursor) return;
    const version = activeRequestVersion.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await fetchPublicProfilesPage(discoveryQuery, cursor);
      if (version !== activeRequestVersion.current) return;
      const nextPages = appendUniqueDiscoveryPage(pagesRef.current, page.profiles);
      pagesRef.current = nextPages;
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setPages(nextPages);
      setHasMore(page.hasMore);
      rememberPages(nextPages, page.cursor, page.hasMore);
    } catch (caughtError: unknown) {
      if (version !== activeRequestVersion.current) return;
      setLoadMoreError(mapDiscoveryError(caughtError).message);
    } finally {
      if (version === activeRequestVersion.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [discoveryQuery, rememberPages]);

  const rankedProfiles = useMemo(() => {
    const ranked = loadedQueryKey === queryKey
      ? pages.flatMap((page) => filterAndRankPublicProfiles([...page], reference))
      : [];
    return excludeBlockedDiscoveryProfiles(ranked, blockedUserIds);
  }, [
    blockedUserIds,
    loadedQueryKey,
    pages,
    queryKey,
    reference,
  ]);
  const profiles = useMemo(
    () => filterPublicProfilesBySegment(rankedProfiles, reference, selectedSegment),
    [rankedProfiles, reference, selectedSegment],
  );
  const segments = useMemo(() => getDiscoverySegmentOptions(reference), [reference]);

  const retry = useCallback(() => {
    discoveryPagesByQuery.delete(queryKey);
    setError(null);
    setRequestVersion((current) => current + 1);
  }, [queryKey]);

  return {
    error,
    hasMore,
    isLoadingMore,
    loadMore,
    loadMoreError,
    profiles,
    reference,
    retry,
    segments,
    selectedSegment,
    setSelectedSegment,
    status: loadedQueryKey === queryKey ? status : 'loading' as const,
  };
}
