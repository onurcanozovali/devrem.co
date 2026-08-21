import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { subscribeToGroupUnreadCount } from '@/services/firebase';
import type { DevreGroupSummary } from './types/groups';

const unreadCountsByUid = new Map<string, Readonly<Record<string, number>>>();

export function useGroupUnreadCounts(groups: readonly DevreGroupSummary[], uid: string | undefined) {
  const groupIds = useMemo(() => groups.map((group) => group.groupId).sort(), [groups]);
  const subscriptionKey = groupIds.join('|');
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>(() => uid ? unreadCountsByUid.get(uid) ?? {} : {});

  useFocusEffect(useCallback(() => {
    if (!uid) return undefined;
    const activeGroupIds = subscriptionKey ? subscriptionKey.split('|') : [];
    if (__DEV__) console.debug(`[perf] subscribe group unread (${activeGroupIds.length * 2} listeners)`);
    const unsubscribers = activeGroupIds.map((groupId) => subscribeToGroupUnreadCount(
      groupId,
      uid,
      (count) => setCounts((current) => {
        if (current[groupId] === count) return current;
        const nextCounts = { ...current, [groupId]: count };
        unreadCountsByUid.set(uid, nextCounts);
        return nextCounts;
      }),
      () => undefined,
    ));
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      if (__DEV__) console.debug('[perf] unsubscribe group unread');
    };
  }, [subscriptionKey, uid]));

  return counts;
}
