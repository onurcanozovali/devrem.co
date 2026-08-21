import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { PublicProfile } from '@/features/matching/types/discovery';
import {
  fetchPublicProfile,
  subscribeToBlockedUserIds,
  subscribeToDirectConversations,
  subscribeToDirectParticipantStates,
  type DirectConversation,
  type DirectParticipantState,
} from '@/services/firebase';
import { forgetVisibleDirectConversation, rememberVisibleDirectConversation } from './directConversationCache';
import { filterVisibleDirectConversationRows } from './directConversationDomain';
import { DIRECT_INBOX_REALTIME_LISTENER_COUNT, subscribeToDirectInboxSources } from './directInboxSubscriptions';

export interface DirectConversationRow {
  conversation: DirectConversation;
  recipient: PublicProfile | null;
  unreadCount: number;
  blocked: boolean;
  hidden: boolean;
}

const conversationRowsByUid = new Map<string, readonly DirectConversationRow[]>();

function perfLog(message: string): void {
  if (__DEV__) console.debug(`[perf] ${message}`);
}

export function useDirectConversationList(uid: string | undefined) {
  const [rows, setRows] = useState<readonly DirectConversationRow[]>(() => uid ? conversationRowsByUid.get(uid) ?? [] : []);

  useFocusEffect(useCallback(() => {
    if (!uid) return undefined;
    let active = true;
    let profileRequestVersion = 0;
    let conversations: readonly DirectConversation[] = [];
    let participantStates: ReadonlyMap<string, DirectParticipantState> = new Map();
    let blockedUserIds: ReadonlySet<string> = new Set();
    let conversationsReady = false;
    let participantStatesReady = false;
    let blockedUsersReady = false;
    const profilesByUid = new Map<string, PublicProfile>();
    for (const row of conversationRowsByUid.get(uid) ?? []) {
      if (row.recipient) profilesByUid.set(row.recipient.userId, row.recipient);
    }

    const publish = () => {
      if (!active || !conversationsReady || !participantStatesReady || !blockedUsersReady) return;
      const nextRows = conversations.map((conversation): DirectConversationRow => {
        const recipientUid = conversation.participantUids.find((participant) => participant !== uid) ?? '';
        const state = participantStates.get(conversation.conversationId);
        const hidden = state?.hidden ?? false;
        if (hidden) forgetVisibleDirectConversation(uid, recipientUid);
        else rememberVisibleDirectConversation(uid, recipientUid, conversation.conversationId);
        return {
          conversation,
          recipient: profilesByUid.get(recipientUid) ?? null,
          unreadCount: state?.unreadCount ?? 0,
          blocked: blockedUserIds.has(recipientUid),
          hidden,
        };
      });
      conversationRowsByUid.set(uid, nextRows);
      setRows(nextRows);
    };

    const loadMissingProfiles = (nextConversations: readonly DirectConversation[]) => {
      const version = ++profileRequestVersion;
      const recipientUids = [...new Set(nextConversations.flatMap((conversation) => (
        conversation.participantUids.filter((participant) => participant !== uid)
      )))].filter((recipientUid) => recipientUid && !profilesByUid.has(recipientUid));
      if (!recipientUids.length) return;
      void Promise.all(recipientUids.map(async (recipientUid) => {
        try {
          const profile = await fetchPublicProfile(recipientUid);
          return profile ? [recipientUid, profile] as const : null;
        } catch {
          return null;
        }
      })).then((profiles) => {
        if (!active || version !== profileRequestVersion) return;
        for (const entry of profiles) if (entry) profilesByUid.set(entry[0], entry[1]);
        publish();
      });
    };

    perfLog(`subscribe conversations inbox (${DIRECT_INBOX_REALTIME_LISTENER_COUNT} fixed listeners)`);
    const stopInbox = subscribeToDirectInboxSources([
      () => subscribeToDirectConversations(uid, (nextConversations) => {
        conversations = nextConversations;
        conversationsReady = true;
        publish();
        loadMissingProfiles(nextConversations);
      }),
      () => subscribeToDirectParticipantStates(uid, (nextStates) => {
        participantStates = nextStates;
        participantStatesReady = true;
        publish();
      }),
      () => subscribeToBlockedUserIds(uid, (nextBlockedUserIds) => {
        blockedUserIds = nextBlockedUserIds;
        blockedUsersReady = true;
        publish();
      }),
    ]);

    return () => {
      active = false;
      profileRequestVersion += 1;
      stopInbox();
      perfLog('unsubscribe conversations inbox');
    };
  }, [uid]));

  return filterVisibleDirectConversationRows(rows);
}
