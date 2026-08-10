import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { getProvinceName } from '@/data/turkeyProvinces';
import {
  DEVRE_CHAT_MESSAGE_MAX_LENGTH,
  mergeDevreChatMessages,
  updateDevreChatMessageStatus,
  validateDevreChatText,
  type DevreChatMessage,
} from '@/features/groups/chatDomain';
import { militaryTypeLabels, monthLabels } from '@/features/profile/profileOptions';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import type { PublicProfile } from '@/features/matching/types/discovery';
import {
  createDevreChatMessageDraft,
  fetchOlderDevreChatMessages,
  sendDevreChatMessage,
  subscribeToRecentDevreChatMessages,
  type DevreChatCursor,
} from '@/services/firebase/chat';
import { useTheme } from '@/theme/ThemeProvider';
import type { DevreGroup } from './types/groups';
import { setActiveDevreGroupChatId } from './activeGroupChat';

interface GroupChatProps {
  group: DevreGroup;
  userId: string;
}

function displayTime(message: DevreChatMessage): string {
  return (message.createdAt ?? message.clientCreatedAt).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && error.code.includes('permission-denied');
}

function GroupMessageRow({
  message,
  onRetry,
  own,
  profile,
}: {
  message: DevreChatMessage;
  onRetry: () => void;
  own: boolean;
  profile: PublicProfile | null;
}) {
  const { colors, radii, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(
    profile?.userId ?? '',
    profile?.photoPath ?? null,
    profile?.updatedAt ?? null,
  );
  return (
    <View style={{ alignItems: own ? 'flex-end' : 'flex-start', marginBottom: spacing.sm }}>
      {!own ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs }}>
          <Avatar
            accessibilityLabel={`${profile?.firstName ?? 'Devre'} profil fotoğrafı`}
            imageURL={photoURL}
            initials={(profile?.firstName ?? 'D').charAt(0)}
            size={28}
          />
          <AppText color="muted" variant="caption" weight="700">{profile?.firstName ?? 'Devre'}</AppText>
        </View>
      ) : null}
      <View style={{
        backgroundColor: own ? colors.primary : colors.surfaceElevated,
        borderColor: own ? colors.primary : colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        maxWidth: '82%',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}>
        <AppText style={{ color: own ? colors.textInverse : colors.textPrimary }}>{message.text}</AppText>
        <AppText
          variant="caption"
          style={{ color: own ? colors.textInverse : colors.textMuted, marginTop: spacing.xs, opacity: 0.75, textAlign: 'right' }}
        >
          {displayTime(message)}{message.status === 'pending' ? ' · Gönderiliyor' : ''}
        </AppText>
      </View>
      {message.status === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <AppText color="danger" variant="caption" weight="700">Gönderilemedi · Tekrar dene</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function GroupChat({ group, userId }: GroupChatProps) {
  const { colors, radii, spacing } = useTheme();
  const listRef = useRef<FlatList<DevreChatMessage>>(null);
  const nearLatestRef = useRef(true);
  const initializedRef = useRef(false);
  const loadedOlderRef = useRef(false);
  const [messages, setMessages] = useState<DevreChatMessage[]>([]);
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState<DevreChatCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const memberProfiles = useMemo(
    () => new Map(group.members.map((member) => [member.userId, member])),
    [group.members],
  );

  useEffect(() => {
    setActiveDevreGroupChatId(group.groupId);
    return () => setActiveDevreGroupChatId(null);
  }, [group.groupId]);

  useEffect(() => {
    return subscribeToRecentDevreChatMessages(
      group.groupId,
      (page) => {
        setMessages((current) => {
          const knownIds = new Set(current.map((message) => message.id));
          const unseenCount = page.messages.filter(
            (message) => message.senderUid !== userId && !knownIds.has(message.id),
          ).length;
          if (initializedRef.current && unseenCount > 0 && !nearLatestRef.current) {
            setNewMessageCount((count) => count + unseenCount);
          }
          return mergeDevreChatMessages(current, page.messages);
        });
        if (!loadedOlderRef.current) {
          setCursor(page.cursor);
          setHasMore(page.hasMore);
        }
        setError(null);
        initializedRef.current = true;
      },
      (caughtError) => {
        if (isPermissionDenied(caughtError)) {
          setMessages([]);
          setAccessLost(true);
          setError('Bu Devre grubuna erişimin sona erdi.');
          return;
        }
        setError('Sohbet bağlantısı kesildi. İnternet bağlantını kontrol edip tekrar dene.');
      },
    );
  }, [group.groupId, userId]);

  const send = useCallback(async (message: DevreChatMessage) => {
    setMessages((current) => mergeDevreChatMessages(current, [message]));
    try {
      await sendDevreChatMessage(group.groupId, message);
    } catch (caughtError: unknown) {
      setMessages((current) => updateDevreChatMessageStatus(current, message.id, 'failed'));
      if (isPermissionDenied(caughtError)) {
        setMessages([]);
        setAccessLost(true);
        setError('Bu Devre grubuna erişimin sona erdi.');
      }
    }
  }, [group.groupId]);

  const submit = useCallback(() => {
    if (accessLost || validateDevreChatText(text)) return;
    const draft = createDevreChatMessageDraft(group.groupId, userId, text);
    setText('');
    nearLatestRef.current = true;
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
    void send(draft);
  }, [accessLost, group.groupId, send, text, userId]);

  const loadOlder = useCallback(async () => {
    if (!cursor || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchOlderDevreChatMessages(group.groupId, cursor);
      loadedOlderRef.current = true;
      setMessages((current) => mergeDevreChatMessages(current, page.messages));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      setError('Eski mesajlar yüklenemedi. Tekrar deneyebilirsin.');
    } finally {
      setLoadingOlder(false);
    }
  }, [cursor, group.groupId, hasMore, loadingOlder]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isNearLatest = event.nativeEvent.contentOffset.y < 80;
    nearLatestRef.current = isNearLatest;
    if (isNearLatest) setNewMessageCount(0);
  }, []);

  const scrollToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
    nearLatestRef.current = true;
    setNewMessageCount(0);
  }, []);

  const validationError = validateDevreChatText(text);

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background, flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <View style={{ borderBottomColor: colors.divider, borderBottomWidth: 1, gap: spacing.xs, padding: spacing.md }}>
          <AppText variant="title" weight="900">Devre Grubum</AppText>
          <AppText color="muted">
            {group.militaryUnitName ?? 'Birlik'} · {getProvinceName(group.militaryCity)} · {group.members.length} üye
          </AppText>
          <AppText variant="caption" weight="700">
            {monthLabels[group.militaryPeriodMonth - 1]} {group.militaryPeriodYear} · {militaryTypeLabels[group.militaryType]}
          </AppText>
        </View>

        {error ? (
          <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.sm }}>
            <AppText color="danger" variant="caption">{error}</AppText>
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(message) => message.id}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.25}
            onScroll={onScroll}
            scrollEventThrottle={100}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', padding: spacing.md }}
            ListEmptyComponent={(
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <AppText weight="800">{accessLost ? 'Sohbet erişimi kapandı' : 'Henüz mesaj yok.'}</AppText>
                <AppText color="muted" style={{ textAlign: 'center' }}>
                  {accessLost ? 'Güncel Devre grubun hazır olduğunda burada görünecek.' : 'İlk mesajı sen gönder. Bu sohbet yalnızca aynı Devre grubundaki üyelere açıktır.'}
                </AppText>
              </View>
            )}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : null}
            renderItem={({ item }) => {
              const own = item.senderUid === userId;
              return (
                <GroupMessageRow
                  message={item}
                  onRetry={() => void send({ ...item, status: 'pending' })}
                  own={own}
                  profile={memberProfiles.get(item.senderUid) ?? null}
                />
              );
            }}
          />

          {newMessageCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={scrollToLatest}
              style={{
                alignSelf: 'center',
                backgroundColor: colors.primary,
                borderRadius: radii.pill,
                bottom: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                position: 'absolute',
              }}
            >
              <AppText style={{ color: colors.textInverse }} weight="800">{newMessageCount} yeni mesaj</AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={{
          alignItems: 'flex-end',
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.sm,
        }}>
          <View style={{ flex: 1 }}>
            <TextInput
              accessibilityLabel="Mesaj"
              editable={!accessLost}
              maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH}
              multiline
              onChangeText={setText}
              placeholder="Devrene mesaj yaz…"
              placeholderTextColor={colors.placeholder}
              style={{
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
                borderRadius: radii.lg,
                borderWidth: 1,
                color: colors.textPrimary,
                maxHeight: 120,
                minHeight: 46,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
              value={text}
            />
            {text.length > DEVRE_CHAT_MESSAGE_MAX_LENGTH - 100 ? (
              <AppText color="muted" variant="caption" style={{ textAlign: 'right' }}>{text.length}/{DEVRE_CHAT_MESSAGE_MAX_LENGTH}</AppText>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Mesajı gönder"
            accessibilityRole="button"
            accessibilityState={{ disabled: accessLost || Boolean(validationError) }}
            disabled={accessLost || Boolean(validationError)}
            onPress={submit}
            style={{
              alignItems: 'center',
              backgroundColor: colors.primary,
              borderRadius: radii.pill,
              height: 46,
              justifyContent: 'center',
              opacity: accessLost || validationError ? 0.45 : 1,
              width: 46,
            }}
          >
            <Ionicons color={colors.textInverse} name="send" size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
