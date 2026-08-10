import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import type { PublicProfile } from '@/features/matching/types/discovery';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import {
  createAudioMessageDraft, createDevreChatMessageDraft, createDevreChatMessageId,
  createImageMessageDraft, fetchOlderDevreChatMessages, sendDevreChatMessage,
  subscribeToRecentDevreChatMessages, uploadChatMedia, type DevreChatCursor,
} from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { ChatMediaView } from './ChatMediaView';
import {
  DEVRE_CHAT_MESSAGE_MAX_LENGTH, formatChatDate, isSameMessageCluster,
  mergeDevreChatMessages, shouldShowDateSeparator, updateDevreChatMessageStatus,
  validateDevreChatText, type DevreChatMessage,
} from './chatDomain';
import { prepareChatImage, selectChatPhoto, takeChatPhoto, type SelectedChatImage } from './chatMedia';
import { setActiveDevreGroupChatId } from './activeGroupChat';
import type { DevreGroup } from './types/groups';

const EMOJI_CATEGORIES = [
  ['Son', '😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '🫡'],
  ['Yüzler', '😀', '😃', '😄', '😁', '😂', '😊', '😍', '🥹', '😎', '🤔', '😭', '😡'],
  ['İnsanlar', '👋', '👍', '👎', '👏', '🙏', '💪', '🫡', '🤝', '👨‍👩‍👧'],
  ['Hayvanlar', '🐶', '🐱', '🐻', '🦁', '🐯', '🐼', '🐦', '🦅', '🐢'],
  ['Yemek', '🍎', '🍕', '🍔', '🥙', '🍰', '☕', '🥤', '🍉', '🥐'],
  ['Aktivite', '⚽', '🏀', '🏃', '🏋️', '🎮', '🎯', '🏆', '🎵', '🎬'],
  ['Seyahat', '🚗', '🚌', '✈️', '🚆', '🚀', '🏠', '🏕️', '🌍', '🗺️'],
  ['Nesneler', '📱', '⌚', '💡', '📷', '🎁', '🔑', '📌', '✉️', '🎒'],
  ['Simgeler', '❤️', '💚', '✅', '❌', '⚠️', '💯', '🔥', '✨', '⭐'],
  ['Bayraklar', '🇹🇷', '🏳️', '🏁', '🚩', '🇦🇿', '🇩🇪', '🇫🇷', '🇬🇧', '🇺🇸'],
] as const;

function messageTime(message: DevreChatMessage): string {
  return (message.createdAt ?? message.clientCreatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' && error.code.includes('permission-denied');
}

const MessageRow = memo(function MessageRow({
  current, groupId, onOpenImage, onRetry, own, profile, showDate, showIdentity,
}: {
  current: DevreChatMessage; groupId: string; onOpenImage: (uri: string) => void; onRetry: () => void;
  own: boolean; profile: PublicProfile | null; showDate: boolean; showIdentity: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(profile?.userId ?? '', profile?.photoPath ?? null, profile?.updatedAt ?? null);
  const textColor = own ? colors.textInverse : colors.textPrimary;
  return (
    <View>
      {showDate ? (
        <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
          <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
            <AppText color="muted" variant="caption" weight="700">{formatChatDate(current.createdAt ?? current.clientCreatedAt)}</AppText>
          </View>
        </View>
      ) : null}
      <View style={{ alignItems: own ? 'flex-end' : 'flex-start', marginBottom: showIdentity ? spacing.sm : spacing.xs }}>
        {!own && showIdentity ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs }}>
            <Avatar accessibilityLabel={`${profile?.firstName ?? 'Devre'} profil fotoğrafı`} imageURL={photoURL} initials={(profile?.firstName ?? 'D').charAt(0)} size={28} />
            <AppText color="muted" variant="caption" weight="700">{profile?.firstName ?? 'Devre'}</AppText>
          </View>
        ) : null}
        <View style={{ backgroundColor: own ? colors.primary : colors.surfaceElevated, borderColor: own ? colors.primary : colors.border, borderRadius: radii.lg, borderWidth: 1, maxWidth: '84%', padding: current.type === 'image' ? spacing.xs : spacing.sm }}>
          {current.type === 'text' ? <AppText style={{ color: textColor }}>{current.text}</AppText> : null}
          {current.type === 'image' ? (
            <>
              {current.localMediaUri ? (
                <Pressable onPress={() => onOpenImage(current.localMediaUri!)}><Image resizeMode="cover" source={{ uri: current.localMediaUri }} style={{ aspectRatio: current.width / current.height, borderRadius: radii.md, width: 230 }} /></Pressable>
              ) : <ChatMediaView groupId={groupId} height={current.height} mediaPath={current.mediaPath} messageId={current.id} onOpen={onOpenImage} width={current.width} />}
              {current.caption ? <AppText style={{ color: textColor, paddingHorizontal: spacing.xs, paddingTop: spacing.sm }}>{current.caption}</AppText> : null}
            </>
          ) : null}
          {current.type === 'audio' ? <AudioMessagePlayer durationMillis={current.durationMillis} groupId={groupId} localUri={current.localMediaUri} mediaPath={current.mediaPath} messageId={current.id} own={own} /> : null}
          <AppText variant="caption" style={{ color: own ? colors.textInverse : colors.textMuted, marginTop: spacing.xs, opacity: 0.75, paddingHorizontal: current.type === 'image' ? spacing.xs : 0, textAlign: 'right' }}>
            {messageTime(current)}{current.status === 'pending' ? ' · Gönderiliyor' : current.status === 'failed' ? ' · Başarısız' : ''}
          </AppText>
        </View>
        {current.status === 'failed' ? <Pressable accessibilityRole="button" onPress={onRetry}><AppText color="danger" variant="caption" weight="700">Tekrar dene</AppText></Pressable> : null}
      </View>
    </View>
  );
});

function EmojiPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, height: 280, padding: spacing.sm }}>
      <FlatList
        data={EMOJI_CATEGORIES}
        keyExtractor={(item) => item[0]}
        keyboardShouldPersistTaps="always"
        renderItem={({ item }) => (
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <AppText color="muted" variant="caption" weight="700">{item[0]}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {item.slice(1).map((emoji) => <Pressable accessibilityLabel={`${emoji} emojisini ekle`} key={emoji} onPress={() => onSelect(emoji)} style={{ alignItems: 'center', height: 44, justifyContent: 'center', width: '12.5%' }}><AppText variant="subtitle">{emoji}</AppText></Pressable>)}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function ChatComposer({ disabled, onAudio, onImage, onSend }: {
  disabled: boolean; onAudio: (uri: string, durationMillis: number) => void;
  onImage: (image: SelectedChatImage) => void; onSend: (text: string) => void;
}) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const holdingRef = useRef(false);
  const finishingRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const recordingLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  useEffect(() => {
    recordingDurationRef.current = recorderState.durationMillis;
  }, [recorderState.durationMillis]);
  useEffect(() => () => {
    if (recordingLimitTimerRef.current) clearTimeout(recordingLimitTimerRef.current);
  }, []);
  const hasText = text.trim().length > 0;
  const finishRecording = useCallback(async (send: boolean) => {
    if (!recorder.isRecording || finishingRef.current) return;
    finishingRef.current = true;
    if (recordingLimitTimerRef.current) {
      clearTimeout(recordingLimitTimerRef.current);
      recordingLimitTimerRef.current = null;
    }
    const duration = Math.min(180000, Math.max(1, recordingDurationRef.current));
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (send && recorder.uri) onAudio(recorder.uri, duration);
    } finally { finishingRef.current = false; }
  }, [onAudio, recorder]);
  const beginRecording = useCallback(async () => {
    holdingRef.current = true;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      holdingRef.current = false;
      Alert.alert('Mikrofon izni gerekli', 'Sesli mesaj kaydetmek için mikrofon izni vermelisin.', [
        { text: 'Vazgeç', style: 'cancel' }, { text: 'Ayarları Aç', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    if (!holdingRef.current) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recordingDurationRef.current = 0;
    recorder.record();
    recordingLimitTimerRef.current = setTimeout(() => {
      holdingRef.current = false;
      void finishRecording(true);
    }, 180000);
  }, [finishRecording, recorder]);
  const releaseRecording = useCallback(() => {
    holdingRef.current = false;
    void finishRecording(true);
  }, [finishRecording]);
  const chooseImage = (camera: boolean) => {
    void (camera ? takeChatPhoto() : selectChatPhoto()).then((image) => { if (image) onImage(image); }).catch((error: unknown) => {
      const permission = error instanceof Error && error.message.includes('permission');
      Alert.alert(permission ? 'İzin gerekli' : 'Fotoğraf açılamadı', permission ? 'Bu işlem için sistem ayarlarından izin verebilirsin.' : 'Lütfen tekrar dene.', permission ? [
        { text: 'Vazgeç', style: 'cancel' }, { text: 'Ayarları Aç', onPress: () => void Linking.openSettings() },
      ] : undefined);
    });
  };
  const openCameraMenu = () => Alert.alert('Fotoğraf paylaş', undefined, [
    { text: 'Fotoğraf Çek', onPress: () => chooseImage(true) },
    { text: 'Galeriden Seç', onPress: () => chooseImage(false) },
    { text: 'Vazgeç', style: 'cancel' },
  ]);
  const insertEmoji = (emoji: string) => {
    setText((current) => `${current.slice(0, selection.start)}${emoji}${current.slice(selection.end)}`);
    const position = selection.start + emoji.length;
    setSelection({ start: position, end: position });
  };
  const toggleEmoji = () => {
    if (emojiOpen) { setEmojiOpen(false); setTimeout(() => inputRef.current?.focus(), 50); }
    else { Keyboard.dismiss(); setEmojiOpen(true); }
  };
  const submit = () => { if (!disabled && !validateDevreChatText(text)) { onSend(text); setText(''); } };
  return (
    <>
      {recorderState.isRecording ? (
        <View style={{ alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row', gap: spacing.md, minHeight: 62, padding: spacing.md }}>
          <View style={{ backgroundColor: colors.danger, borderRadius: radii.pill, height: 10, width: 10 }} />
          <AppText weight="800">{Math.floor(recorderState.durationMillis / 60000)}:{String(Math.floor(recorderState.durationMillis / 1000) % 60).padStart(2, '0')}</AppText>
          <AppText color="muted" style={{ flex: 1 }}>Bırakınca gönderilir</AppText>
          <Pressable accessibilityRole="button" onPress={() => void finishRecording(false)}><AppText color="danger" weight="800">İptal</AppText></Pressable>
        </View>
      ) : (
        <View style={{ alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingBottom: emojiOpen ? spacing.sm : Math.max(spacing.sm, insets.bottom), paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
          <Pressable accessibilityLabel={emojiOpen ? 'Klavyeyi aç' : 'Emoji panelini aç'} accessibilityRole="button" onPress={toggleEmoji} style={{ alignItems: 'center', height: 46, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textMuted} name={emojiOpen ? 'keypad-outline' : 'happy-outline'} size={25} /></Pressable>
          <View style={{ alignItems: 'flex-end', backgroundColor: colors.inputBackground, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flex: 1, flexDirection: 'row' }}>
            <TextInput
              ref={inputRef} accessibilityLabel="Mesaj" editable={!disabled} maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH} multiline
              onChangeText={setText} onFocus={() => setEmojiOpen(false)}
              onSelectionChange={(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => setSelection(event.nativeEvent.selection)}
              placeholder="Mesaj" placeholderTextColor={colors.placeholder} selection={selection}
              style={{ color: colors.textPrimary, flex: 1, maxHeight: 112, minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }} value={text}
            />
            <Pressable accessibilityLabel="Fotoğraf paylaş" accessibilityRole="button" onPress={openCameraMenu} style={{ alignItems: 'center', height: 46, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textMuted} name="camera-outline" size={24} /></Pressable>
          </View>
          <Pressable
            accessibilityLabel={hasText ? 'Mesajı gönder' : 'Sesli mesaj kaydet'} accessibilityRole="button"
            disabled={disabled} onPress={hasText ? submit : undefined} onPressIn={hasText ? undefined : () => void beginRecording()} onPressOut={hasText ? undefined : releaseRecording}
            style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 46, justifyContent: 'center', opacity: disabled ? 0.45 : 1, width: 46 }}
          ><Ionicons color={colors.textInverse} name={hasText ? 'send' : 'mic'} size={22} /></Pressable>
        </View>
      )}
      {emojiOpen ? <EmojiPanel onSelect={insertEmoji} /> : null}
    </>
  );
}

export function GroupChat({ group, userId }: { group: DevreGroup; userId: string }) {
  const { colors, spacing } = useTheme();
  const listRef = useRef<FlatList<DevreChatMessage>>(null);
  const nearLatestRef = useRef(true);
  const initializedRef = useRef(false);
  const loadedOlderRef = useRef(false);
  const [messages, setMessages] = useState<DevreChatMessage[]>([]);
  const [cursor, setCursor] = useState<DevreChatCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [preview, setPreview] = useState<SelectedChatImage | null>(null);
  const [caption, setCaption] = useState('');
  const [previewSending, setPreviewSending] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const profiles = useMemo(() => new Map(group.members.map((member) => [member.userId, member])), [group.members]);
  useEffect(() => { setActiveDevreGroupChatId(group.groupId); return () => setActiveDevreGroupChatId(null); }, [group.groupId]);
  useEffect(() => subscribeToRecentDevreChatMessages(group.groupId, (page) => {
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      const unseen = page.messages.filter((message) => message.senderUid !== userId && !known.has(message.id)).length;
      if (initializedRef.current && unseen && !nearLatestRef.current) setNewCount((count) => count + unseen);
      return mergeDevreChatMessages(current, page.messages);
    });
    if (!loadedOlderRef.current) { setCursor(page.cursor); setHasMore(page.hasMore); }
    initializedRef.current = true; setError(null);
  }, (caughtError) => {
    if (isPermissionDenied(caughtError)) { setMessages([]); setAccessLost(true); setError('Bu Devre grubuna erişimin sona erdi.'); }
    else setError('Sohbet bağlantısı kesildi. İnternet bağlantını kontrol edip tekrar dene.');
  }), [group.groupId, userId]);

  const persist = useCallback(async (message: DevreChatMessage) => {
    setMessages((current) => mergeDevreChatMessages(current, [message]));
    try {
      if (message.type === 'image' || message.type === 'audio') {
        if (!message.localMediaUri) throw new Error('missing-local-media');
        await uploadChatMedia({ groupId: group.groupId, kind: message.type, localUri: message.localMediaUri, messageId: message.id, senderUid: userId });
      }
      await sendDevreChatMessage(group.groupId, message);
    } catch (caughtError: unknown) {
      setMessages((current) => updateDevreChatMessageStatus(current, message.id, 'failed'));
      if (isPermissionDenied(caughtError)) { setMessages([]); setAccessLost(true); setError('Bu Devre grubuna erişimin sona erdi.'); }
    }
  }, [group.groupId, userId]);
  const sendText = useCallback((text: string) => {
    const draft = createDevreChatMessageDraft(group.groupId, userId, text); nearLatestRef.current = true;
    listRef.current?.scrollToOffset({ animated: true, offset: 0 }); void persist(draft);
  }, [group.groupId, persist, userId]);
  const sendAudio = useCallback((uri: string, durationMillis: number) => {
    const id = createDevreChatMessageId(group.groupId);
    void persist(createAudioMessageDraft({ durationMillis, groupId: group.groupId, localMediaUri: uri, messageId: id, senderUid: userId }));
  }, [group.groupId, persist, userId]);
  const sendImage = async () => {
    if (!preview) return; setPreviewSending(true);
    try {
      const prepared = await prepareChatImage(preview); const id = createDevreChatMessageId(group.groupId);
      const draft = createImageMessageDraft({ caption, groupId: group.groupId, height: prepared.height, localMediaUri: prepared.uri, messageId: id, senderUid: userId, width: prepared.width });
      setPreview(null); setCaption(''); void persist(draft);
    } catch { Alert.alert('Fotoğraf hazırlanamadı', 'Lütfen başka bir fotoğrafla tekrar dene.'); }
    finally { setPreviewSending(false); }
  };
  const loadOlder = useCallback(async () => {
    if (!cursor || !hasMore || loadingOlder) return; setLoadingOlder(true);
    try { const page = await fetchOlderDevreChatMessages(group.groupId, cursor); loadedOlderRef.current = true; setMessages((current) => mergeDevreChatMessages(current, page.messages)); setCursor(page.cursor); setHasMore(page.hasMore); }
    catch { setError('Eski mesajlar yüklenemedi.'); } finally { setLoadingOlder(false); }
  }, [cursor, group.groupId, hasMore, loadingOlder]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { const near = event.nativeEvent.contentOffset.y < 80; nearLatestRef.current = near; if (near) setNewCount(0); };
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background, flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 58, paddingHorizontal: spacing.sm }}>
          <Pressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={() => router.back()} style={{ alignItems: 'center', height: 48, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textPrimary} name="arrow-back" size={25} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/group-info/[groupId]', params: { groupId: group.groupId } })} style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm }}>
            <Avatar accessibilityLabel="Devre grubu" imageURL={null} initials={(group.militaryUnitName ?? 'D').charAt(0)} size={42} />
            <View style={{ flex: 1 }}><AppText numberOfLines={1} weight="900">{group.militaryUnitName ?? 'Devre Grubu'}</AppText><AppText color="muted" variant="caption">{group.members.length} üye</AppText></View>
          </Pressable>
          <Pressable accessibilityLabel="Daha fazla" accessibilityRole="button" onPress={() => Alert.alert('Grup', undefined, [{ text: 'Grup Bilgisi', onPress: () => router.push({ pathname: '/group-info/[groupId]', params: { groupId: group.groupId } }) }, { text: 'Vazgeç', style: 'cancel' }])} style={{ alignItems: 'center', height: 48, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textPrimary} name="ellipsis-vertical" size={22} /></Pressable>
        </View>
        {error ? <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.sm }}><AppText color="danger" variant="caption">{error}</AppText></View> : null}
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef} contentContainerStyle={{ flexGrow: 1, padding: spacing.md }} data={messages} inverted keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
            keyExtractor={(message) => message.id} onEndReached={() => void loadOlder()} onEndReachedThreshold={0.25} onScroll={onScroll} scrollEventThrottle={100}
            ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: spacing.xl }}><AppText weight="800">{accessLost ? 'Sohbet erişimi kapandı' : 'Henüz mesaj yok.'}</AppText><AppText color="muted">{accessLost ? 'Güncel grubun hazır olduğunda burada görünecek.' : 'İlk mesajı sen gönder.'}</AppText></View>}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} /> : null}
            renderItem={({ item, index }) => <MessageRow current={item} groupId={group.groupId} onOpenImage={setViewerUri} onRetry={() => void persist({ ...item, status: 'pending' })} own={item.senderUid === userId} profile={profiles.get(item.senderUid) ?? null} showDate={shouldShowDateSeparator(messages[index + 1], item)} showIdentity={!isSameMessageCluster(messages[index + 1], item)} />}
          />
          {newCount ? <Pressable onPress={() => { listRef.current?.scrollToOffset({ animated: true, offset: 0 }); setNewCount(0); }} style={{ alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 999, bottom: spacing.sm, padding: spacing.sm, position: 'absolute' }}><AppText style={{ color: colors.textInverse }} weight="800">{newCount} yeni mesaj</AppText></Pressable> : null}
        </View>
        <ChatComposer disabled={accessLost} onAudio={sendAudio} onImage={setPreview} onSend={sendText} />
      </KeyboardAvoidingView>
      <Modal animationType="slide" onRequestClose={() => setPreview(null)} visible={Boolean(preview)}><SafeAreaView style={{ backgroundColor: '#000', flex: 1 }}><View style={{ alignItems: 'center', flexDirection: 'row', padding: spacing.sm }}><Pressable accessibilityLabel="Önizlemeyi kapat" onPress={() => setPreview(null)} style={{ padding: spacing.md }}><Ionicons color="#fff" name="close" size={28} /></Pressable><AppText style={{ color: '#fff', flex: 1 }} weight="800">Fotoğraf Önizleme</AppText></View>{preview ? <Image resizeMode="contain" source={{ uri: preview.uri }} style={{ flex: 1, width: '100%' }} /> : null}<View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}><TextInput maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH} onChangeText={setCaption} placeholder="Bir açıklama ekle…" placeholderTextColor="#aaa" style={{ backgroundColor: '#222', borderRadius: 18, color: '#fff', flex: 1, minHeight: 48, padding: spacing.md }} value={caption} /><Pressable disabled={previewSending} onPress={() => void sendImage()} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 }}>{previewSending ? <ActivityIndicator color="#fff" /> : <Ionicons color="#fff" name="send" size={22} />}</Pressable></View></SafeAreaView></Modal>
      <Modal animationType="fade" onRequestClose={() => setViewerUri(null)} visible={Boolean(viewerUri)}><SafeAreaView style={{ backgroundColor: '#000', flex: 1 }}><Pressable accessibilityLabel="Fotoğrafı kapat" onPress={() => setViewerUri(null)} style={{ alignSelf: 'flex-start', padding: spacing.md }}><Ionicons color="#fff" name="close" size={30} /></Pressable>{viewerUri ? <Image resizeMode="contain" source={{ uri: viewerUri }} style={{ flex: 1, width: '100%' }} /> : null}</SafeAreaView></Modal>
    </SafeAreaView>
  );
}
