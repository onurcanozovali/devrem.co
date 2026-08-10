import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { GroupChat } from './GroupChat';
import { useCurrentDevreGroup } from './useCurrentDevreGroup';
import { markReturningFromGroupChat } from './groupChatNavigation';

export function GroupChatRouteScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[]; source?: string | string[] }>();
  const navigation = useNavigation();
  const groupId = typeof params.groupId === 'string' ? params.groupId : '';
  const { error, result, retry, session } = useCurrentDevreGroup();
  useEffect(() => navigation.addListener('beforeRemove', () => {
    if (params.source === 'groupTab') markReturningFromGroupChat();
  }), [navigation, params.source]);
  if (error) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Sohbet açılamadı" description={error} actionLabel="Tekrar dene" onAction={retry} /></ScreenContainer>;
  if (!result) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Sohbet açılıyor…" /></ScreenContainer>;
  if (result.status !== 'ready' || result.group.groupId !== groupId || !session) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Bu grup erişilebilir değil" description="Yalnızca güncel canonical Devre grubunun sohbetini açabilirsin." /></ScreenContainer>;
  }
  return <GroupChat group={result.group} userId={session.userId} />;
}
