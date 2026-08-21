import type { DiscoveryQuery, PublicProfile } from '../types/discovery';

export const DISCOVERY_PAGE_SIZE = 40;

export interface DiscoveryPageRequest {
  cursor: string | null;
  limit: number;
}

export function createDiscoveryPageRequest(cursor: string | null = null): DiscoveryPageRequest {
  return { cursor, limit: DISCOVERY_PAGE_SIZE };
}

export function getDiscoveryQueryKey(reference: DiscoveryQuery): string {
  return [
    reference.militaryPeriodYear,
    reference.militaryPeriodMonth,
    reference.militaryCity,
    reference.militaryType,
    reference.militaryUnitId ?? 'legacy-unit-name',
  ].join(':');
}

export function shouldResetDiscoveryPagination(previousQueryKey: string, nextQueryKey: string): boolean {
  return previousQueryKey !== nextQueryKey;
}

export function hasMoreDiscoveryPages(documentCount: number): boolean {
  return documentCount === DISCOVERY_PAGE_SIZE;
}

export function canLoadNextDiscoveryPage(input: { hasMore: boolean; isLoading: boolean }): boolean {
  return input.hasMore && !input.isLoading;
}

export function excludeBlockedDiscoveryProfiles(
  profiles: readonly PublicProfile[],
  blockedUserIds: ReadonlySet<string>,
): PublicProfile[] {
  return profiles.filter(({ userId }) => !blockedUserIds.has(userId));
}

export function appendUniqueDiscoveryPage(
  currentPages: readonly (readonly PublicProfile[])[],
  incomingProfiles: readonly PublicProfile[],
): readonly (readonly PublicProfile[])[] {
  const seen = new Set(currentPages.flatMap((page) => page.map(({ userId }) => userId)));
  const nextPage = incomingProfiles.filter(({ userId }) => {
    if (seen.has(userId)) return false;
    seen.add(userId);
    return true;
  });
  return nextPage.length > 0 ? [...currentPages, nextPage] : currentPages;
}
