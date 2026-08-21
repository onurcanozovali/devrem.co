import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { MainTabHeader } from '@/components/common/MainTabHeader';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useDirectConversationList, type DirectConversationRow } from '@/features/directMessages/useDirectConversationList';
import { getPublicProfileDisplayName } from '@/features/matching/services/discoveryDomain';
import { ForceAvatar } from '@/features/militaryUnits/ForceAvatar';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { useTheme } from '@/theme/ThemeProvider';
import type { DevreGroupSummary } from './types/groups';
import { useCurrentDevreGroup } from './useCurrentDevreGroup';
import { useGroupUnreadCounts } from './useGroupUnreadCounts';

type ConversationItem =
  | { activityAt: Date | null; group: DevreGroupSummary; id: string; type: 'group' }
  | { activityAt: Date | null; id: string; row: DirectConversationRow; type: 'direct' };

function groupTitle(group: DevreGroupSummary): string {
  return group.kind === 'travel' ? 'Yol Arkadaşları' : 'Devre Grubu';
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function conversationSearchText(item: ConversationItem): string {
  if (item.type === 'direct') {
    return [item.row.recipient ? getPublicProfileDisplayName(item.row.recipient) : null, item.row.conversation.lastMessagePreview]
      .filter(Boolean)
      .join(' ');
  }
  return [
    groupTitle(item.group),
    item.group.militaryUnitName,
    item.group.departureCity,
    item.group.militaryCity,
    item.group.lastMessagePreview,
  ].filter(Boolean).join(' ');
}

export function GroupScreen() {
  const { colors, spacing } = useTheme();
  const { error, groups, profile, result, retry, session } = useCurrentDevreGroup();
  const unreadCounts = useGroupUnreadCounts(groups, session?.userId);
  const directRows = useDirectConversationList(session?.userId);
  const [query, setQuery] = useState('');

  const conversations = useMemo<ConversationItem[]>(() => [
    ...groups.map((group) => ({ id: group.groupId, type: 'group' as const, activityAt: group.lastMessageAt, group })),
    ...directRows.map((row) => ({ id: row.conversation.conversationId, type: 'direct' as const, activityAt: row.conversation.lastMessageAt, row })),
  ].sort((left, right) => (right.activityAt?.getTime() ?? 0) - (left.activityAt?.getTime() ?? 0)), [directRows, groups]);

  const visibleConversations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return conversations;
    return conversations.filter((item) => normalizeSearchText(conversationSearchText(item)).includes(normalizedQuery));
  }, [conversations, query]);

  if (!profile?.militaryUnitId && !profile?.militaryUnit) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Devre grupların henüz oluşmadı" description="Birlik bilgin tamamlandığında grupların otomatik hazırlanacak." /></ScreenContainer>;
  }
  if (error) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Gruplar yüklenemedi" description={error} actionLabel="Tekrar dene" onAction={retry} /></ScreenContainer>;
  }
  if (!result) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Sohbetlerin yükleniyor…" /></ScreenContainer>;
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.background, flex: 1 }}>
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
      <MainTabHeader title="Sohbetler" subtitle="Grupların ve özel mesajların" />
      <View style={{
        alignItems: 'center',
        backgroundColor: colors.surfaceSecondary,
        borderRadius: 14,
        flexDirection: 'row',
        gap: spacing.sm,
        height: 46,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
        paddingHorizontal: 14,
      }}>
        <Ionicons color={colors.textMuted} name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Sohbetlerde ara"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Sohbetlerde ara"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={{ color: colors.textPrimary, flex: 1, fontSize: 15, height: '100%', paddingVertical: 0 }}
          value={query}
        />
        {query ? <Pressable accessibilityLabel="Aramayı temizle" accessibilityRole="button" hitSlop={10} onPress={() => setQuery('')}>
          <Ionicons color={colors.textMuted} name="close-circle" size={20} />
        </Pressable> : null}
      </View>
    </View>
    <FlatList
      contentContainerStyle={{ flexGrow: visibleConversations.length ? 0 : 1, paddingBottom: spacing.xl }}
      data={visibleConversations}
      initialNumToRender={12}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyConversationList searching={Boolean(query.trim())} />}
      maxToRenderPerBatch={12}
      renderItem={({ index, item }) => item.type === 'direct'
        ? <DirectConversationRowItem row={item.row} showDivider={index < visibleConversations.length - 1} />
        : <GroupConversationRow group={item.group} showDivider={index < visibleConversations.length - 1} unreadCount={unreadCounts[item.id] ?? 0} />}
      windowSize={7}
    />
  </SafeAreaView>;
}

function EmptyConversationList({ searching }: { searching: boolean }) {
  const { colors, spacing } = useTheme();
  return <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl }}>
    <Ionicons color={colors.textMuted} name={searching ? 'search-outline' : 'chatbubble-outline'} size={28} />
    <AppText weight="800">{searching ? 'Sohbet bulunamadı' : 'Henüz sohbetin yok'}</AppText>
    <AppText color="muted" variant="caption" style={{ textAlign: 'center' }}>
      {searching ? 'Farklı bir kişi, grup veya mesaj ara.' : 'Bir Devrem profiline giderek özel sohbet başlatabilirsin.'}
    </AppText>
  </View>;
}

function formatConversationTime(value: Date | null): string {
  if (!value) return '';
  const today = new Date();
  if (value.toDateString() === today.toDateString()) {
    return value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === yesterday.toDateString()) return 'Dün';
  return value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function RowDivider() {
  const { colors } = useTheme();
  return <View pointerEvents="none" style={{ backgroundColor: colors.divider, bottom: 0, height: StyleSheet.hairlineWidth, left: 80, position: 'absolute', right: 16 }} />;
}

function UnreadBadge({ count }: { count: number }) {
  const { colors } = useTheme();
  if (!count) return null;
  return <View accessibilityLabel={`${count} okunmamış mesaj`} style={{
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 21,
    minWidth: 21,
    paddingHorizontal: 6,
  }}>
    <AppText variant="caption" weight="900" style={{ color: colors.textInverse, fontSize: 11, lineHeight: 15 }}>{count > 99 ? '99+' : count}</AppText>
  </View>;
}

const DirectConversationRowItem = memo(function DirectConversationRowItem({ row, showDivider }: { row: DirectConversationRow; showDivider: boolean }) {
  const { colors, spacing } = useTheme();
  const title = row.recipient ? getPublicProfileDisplayName(row.recipient) : 'Silinmiş kullanıcı';
  const photoURL = useProfilePhotoURL(row.recipient?.userId ?? '', row.recipient?.photoPath ?? null, row.recipient?.updatedAt ?? null);
  const unread = row.unreadCount > 0;
  return <Pressable
    accessibilityLabel={`${title} ile özel sohbeti aç`}
    accessibilityRole="button"
    onPress={() => router.push({ pathname: '/direct-chat/[conversationId]', params: { conversationId: row.conversation.conversationId } })}
    style={({ pressed }) => ({
      alignItems: 'center', backgroundColor: pressed ? colors.surfaceSecondary : colors.background, flexDirection: 'row', gap: 12,
      minHeight: 76, paddingHorizontal: spacing.md, paddingVertical: 10, position: 'relative',
    })}
  >
    <Avatar accessibilityLabel={`${title} profil fotoğrafı`} imageURL={photoURL} initials={title.charAt(0)} size={52} />
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <AppText weight={unread ? '900' : '700'} numberOfLines={1} style={{ flex: 1, fontSize: 16, lineHeight: 21 }}>{title}</AppText>
        <AppText color={unread ? undefined : 'muted'} variant="caption" weight={unread ? '800' : '400'} style={unread ? { color: colors.primary } : undefined}>{formatConversationTime(row.conversation.lastMessageAt)}</AppText>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <AppText color="muted" numberOfLines={1} weight={unread ? '700' : '400'} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>
          {row.blocked ? 'Engellendi' : row.conversation.lastMessagePreview ?? 'Sohbeti başlat'}
        </AppText>
        {row.blocked ? <Ionicons color={colors.textMuted} name="ban-outline" size={16} /> : null}
        <UnreadBadge count={row.unreadCount} />
      </View>
    </View>
    {showDivider ? <RowDivider /> : null}
  </Pressable>;
});

const GroupConversationRow = memo(function GroupConversationRow({ group, showDivider, unreadCount }: { group: DevreGroupSummary; showDivider: boolean; unreadCount: number }) {
  const { colors, spacing } = useTheme();
  const title = groupTitle(group);
  const openChat = () => router.push({
    pathname: '/group-chat/[groupId]',
    params: { groupId: group.groupId, returnTo: '/(tabs)/chats', source: 'groupTab' },
  });
  return <Pressable
    accessibilityLabel={`${title} sohbetini aç`}
    accessibilityRole="button"
    onPress={openChat}
    style={({ pressed }) => ({
      alignItems: 'center', backgroundColor: pressed ? colors.surfaceSecondary : colors.background, flexDirection: 'row', gap: 12,
      minHeight: 76, paddingHorizontal: spacing.md, paddingVertical: 10, position: 'relative',
    })}
  >
    <ForceAvatar forceCode={group.forceCode} label={title} size={52} />
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <AppText weight={unreadCount ? '900' : '700'} numberOfLines={1} style={{ flex: 1, fontSize: 16, lineHeight: 21 }}>{title}</AppText>
        <AppText color={unreadCount ? undefined : 'muted'} variant="caption" weight={unreadCount ? '800' : '400'} style={unreadCount ? { color: colors.primary } : undefined}>{formatConversationTime(group.lastMessageAt)}</AppText>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <AppText color="muted" numberOfLines={1} weight={unreadCount ? '700' : '400'} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>{group.lastMessagePreview ?? group.militaryUnitName ?? 'Sohbeti aç'}</AppText>
        <UnreadBadge count={unreadCount} />
      </View>
    </View>
    {showDivider ? <RowDivider /> : null}
  </Pressable>;
});
