import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Modal, PanResponder, Platform, Pressable, TextInput, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView, KeyboardGestureArea, KeyboardStickyView, type KeyboardChatScrollViewProps } from 'react-native-keyboard-controller';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import type { PublicProfile } from '@/features/matching/types/discovery';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import {
  createDevreChatMessageDraft, createDevreChatMessageId,
  createDocumentMessageDraft, createImageMessageDraft, deleteGroupMessageForEveryone,
  fetchHiddenGroupMessageIds, fetchOlderDevreChatMessages, hideGroupMessageForUser,
  markDevreGroupRead, sendDevreChatMessage, subscribeToGroupReadCursors,
  subscribeToRecentDevreChatMessages, type DevreChatCursor,
  type DevreGroupReadCursor,
} from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { ChatBottomSheet, type ChatSheetAction } from './ChatBottomSheet';
import { ChatCameraModal } from './ChatCameraModal';
import { ChatComposer } from './ChatComposer';
import { ChatMediaView } from './ChatMediaView';
import { DocumentMessage } from './DocumentMessage';
import { setActiveDevreGroupChatId } from './activeGroupChat';
import { selectChatDocument, type SelectedChatDocument } from './chatDocuments';
import {
  collapseDevreChatText, formatChatDate, getDevreChatMessagePreview, isSameMessageCluster, mergeDevreChatMessages, shouldShowDateSeparator,
  updateDevreChatMessageStatus, type DevreChatMessage,
} from './chatDomain';
import { prepareChatImage, selectChatPhoto, type SelectedChatImage } from './chatMedia';
import type { DevreGroup } from './types/groups';
import { uploadAndSendDevreChatMediaMessage } from './services/sendChatMedia';

function messageTime(message: DevreChatMessage): string {
  return (message.createdAt ?? message.clientCreatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' && error.code.includes('permission-denied');
}

const ChatScrollView = forwardRef<ComponentRef<typeof KeyboardChatScrollView>, ScrollViewProps & KeyboardChatScrollViewProps>(function ChatScrollView(props, ref) {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  return <KeyboardChatScrollView
    {...props}
    ref={ref}
    automaticallyAdjustContentInsets={false}
    contentInsetAdjustmentBehavior="never"
    inverted={props.inverted}
    keyboardDismissMode={isAndroid ? 'on-drag' : 'interactive'}
    keyboardLiftBehavior={isAndroid ? 'never' : 'always'}
    offset={Math.max(insets.bottom - 8, 0)}
  />;
});

const MessageRow = memo(function MessageRow({
  current, groupId, onLongPress, onOpenImage, onOpenReply, onReply, onRetry, own, profile, readByOthers,
  replyMessage, replySender, showDate, showIdentity,
}: {
  current: DevreChatMessage;
  groupId: string;
  onLongPress: () => void;
  onOpenImage: (uri: string) => void;
  onOpenReply: () => void;
  onReply: () => void;
  onRetry: () => void;
  own: boolean;
  profile: PublicProfile | null;
  readByOthers: boolean;
  replyMessage: DevreChatMessage | null;
  replySender: string | null;
  showDate: boolean;
  showIdentity: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(profile?.userId ?? '', profile?.photoPath ?? null, profile?.updatedAt ?? null);
  const bubble = own ? colors.chatBubbleMine : colors.chatBubbleOther;
  const textColor = own ? colors.chatTextMine : colors.chatTextOther;
  const timestampColor = own ? colors.chatTimestampMine : colors.chatTimestampOther;
  const collapsedText = current.type === 'text' ? collapseDevreChatText(current.text) : null;
  const [textExpanded, setTextExpanded] = useState(false);
  const [translateX] = useState(() => new Animated.Value(0));
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35,
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.min(76, Math.max(0, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx >= 54) onReply();
      Animated.spring(translateX, { friction: 7, tension: 90, toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
  }), [onReply, translateX]);
  const status = <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 3, marginLeft: spacing.sm }}>
    <AppText variant="caption" style={{ color: timestampColor }}>{messageTime(current)}</AppText>
    {own && current.status === 'pending' ? <Ionicons color={timestampColor} name="time-outline" size={14} /> : null}
    {own && current.status === 'sent' ? <Ionicons color={readByOthers ? colors.primary : timestampColor} name={readByOthers ? 'checkmark-done' : 'checkmark'} size={16} /> : null}
    {own && current.status === 'failed' ? <Ionicons color={colors.danger} name="alert-circle" size={15} /> : null}
  </View>;
  return <View>
    {showDate ? <View style={{ alignItems: 'center', marginVertical: spacing.md }}><View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}><AppText color="muted" variant="caption" weight="800">{formatChatDate(current.createdAt ?? current.clientCreatedAt)}</AppText></View></View> : null}
    <View style={{ alignItems: own ? 'flex-end' : 'flex-start', marginBottom: showIdentity ? spacing.sm : 2 }}>
      {!own && showIdentity ? <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginBottom: 3, marginLeft: 2 }}><Avatar accessibilityLabel={`${profile?.firstName ?? 'Devre'} profil fotoğrafı`} imageURL={photoURL} initials={(profile?.firstName ?? 'D').charAt(0)} size={27} /><AppText color="muted" variant="caption" weight="800">{profile?.firstName ?? 'Devre'}</AppText></View> : null}
      <View style={{ maxWidth: '100%', minWidth: 76 }}>
      <View pointerEvents="none" style={{ alignItems: 'center', height: 44, justifyContent: 'center', left: 8, position: 'absolute', top: '50%', transform: [{ translateY: -22 }], width: 44 }}><Ionicons color={colors.primary} name="return-up-back" size={23} /></View>
      <Animated.View {...panResponder.panHandlers} style={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '84%', transform: [{ translateX }] }}>
      <Pressable accessibilityRole="button" delayLongPress={350} onLongPress={onLongPress} style={{ backgroundColor: bubble, borderColor: own ? bubble : colors.border, borderRadius: radii.md, borderWidth: 1, minWidth: 76, padding: current.type === 'image' && !current.deletedForEveryone ? 4 : spacing.sm }}>
        {current.replyToMessageId ? <Pressable accessibilityLabel="Yanıtlanan mesaja git" onPress={onOpenReply} style={{ backgroundColor: own ? colors.chatBubbleMine : colors.surfaceSecondary, borderLeftColor: colors.primary, borderLeftWidth: 4, borderRadius: radii.sm, marginBottom: spacing.xs, opacity: 0.92, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}><AppText style={{ color: colors.primary }} variant="caption" weight="900">{replySender ?? 'Devre'}</AppText><AppText color="muted" numberOfLines={2} variant="caption">{replyMessage ? getDevreChatMessagePreview(replyMessage) : 'Yanıtlanan mesaj'}</AppText></Pressable> : null}
        {current.deletedForEveryone ? <View style={{ alignItems: 'flex-end', flexDirection: 'row' }}><View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: spacing.sm }}><Ionicons color={colors.chatDeletedText} name="ban-outline" size={18} /><AppText style={{ color: colors.chatDeletedText, flexShrink: 1, fontStyle: 'italic' }}>Bu mesaj silindi</AppText></View>{status}</View> : <>
          {current.type === 'text' ? <View style={{ alignItems: 'flex-end', flexDirection: 'row' }}><View style={{ flexShrink: 1 }}><AppText style={{ color: textColor }}>{collapsedText && !textExpanded ? collapsedText : current.text}</AppText>{collapsedText ? <Pressable accessibilityRole="button" onPress={() => setTextExpanded((value) => !value)} style={{ alignSelf: 'flex-start', minHeight: 28, paddingTop: 3 }}><AppText style={{ color: textColor }} variant="caption" weight="900">{textExpanded ? 'Daha az göster' : 'Devamını oku'}</AppText></Pressable> : null}</View>{status}</View> : null}
          {current.type === 'image' ? <>{current.localMediaUri ? <Pressable onPress={() => onOpenImage(current.localMediaUri!)}><Image resizeMode="cover" source={{ uri: current.localMediaUri }} style={{ aspectRatio: current.width / current.height, borderRadius: radii.sm, width: 230 }} /></Pressable> : <ChatMediaView groupId={groupId} height={current.height} mediaPath={current.mediaPath} messageId={current.id} onOpen={onOpenImage} width={current.width} />}{current.caption ? <AppText style={{ color: textColor, paddingHorizontal: 4, paddingTop: spacing.sm }}>{current.caption}</AppText> : null}<View style={{ alignItems: 'flex-end', paddingHorizontal: 4, paddingTop: 3 }}>{status}</View></> : null}
          {current.type === 'audio' ? <><AudioMessagePlayer durationMillis={current.durationMillis} groupId={groupId} localUri={current.localMediaUri} mediaPath={current.mediaPath} messageId={current.id} own={own} /><View style={{ alignItems: 'flex-end' }}>{status}</View></> : null}
          {current.type === 'document' ? <><DocumentMessage groupId={groupId} message={current} textColor={textColor} /><View style={{ alignItems: 'flex-end', paddingTop: 3 }}>{status}</View></> : null}
        </>}
      </Pressable>
      </Animated.View>
      </View>
      {current.status === 'failed' ? <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 34, justifyContent: 'center' }}><AppText color="danger" variant="caption" weight="800">Tekrar dene</AppText></Pressable> : null}
    </View>
  </View>;
});

function PhotoPreview({ caption, image, onCaption, onClose, onSend, sending }: {
  caption: string; image: SelectedChatImage | null; onCaption: (value: string) => void;
  onClose: () => void; onSend: () => void; sending: boolean;
}) {
  const { colors, spacing } = useTheme();
  return <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(image)}><SafeAreaView style={{ backgroundColor: '#050706', flex: 1 }}><View style={{ alignItems: 'center', flexDirection: 'row', padding: spacing.sm }}><Pressable accessibilityLabel="Önizlemeyi kapat" onPress={onClose} style={{ padding: spacing.md }}><Ionicons color="#fff" name="close" size={28} /></Pressable><AppText style={{ color: '#fff', flex: 1 }} weight="900">Fotoğraf Önizleme</AppText></View>{image ? <Image resizeMode="contain" source={{ uri: image.uri }} style={{ flex: 1, width: '100%' }} /> : null}<View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}><TextInput maxLength={1500} onChangeText={onCaption} placeholder="Bir açıklama ekle…" placeholderTextColor="#aaa" style={{ backgroundColor: '#202321', borderRadius: 23, color: '#fff', flex: 1, minHeight: 48, padding: spacing.md }} value={caption} /><Pressable disabled={sending} onPress={onSend} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 }}>{sending ? <ActivityIndicator color="#fff" /> : <Ionicons color={colors.textInverse} name="send" size={22} />}</Pressable></View></SafeAreaView></Modal>;
}

function MessageInfoModal({ cursors, group, message, onClose }: {
  cursors: readonly DevreGroupReadCursor[]; group: DevreGroup; message: DevreChatMessage | null; onClose: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  if (!message) return null;
  const sentAt = message.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const readers = group.members.filter((member) => member.userId !== message.senderUid).flatMap((member) => {
    const cursor = cursors.find((item) => item.uid === member.userId);
    return cursor && cursor.lastReadMessageCreatedAt.getTime() >= sentAt ? [{ member, cursor }] : [];
  });
  return <Modal animationType="slide" onRequestClose={onClose} visible><SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}><View style={{ alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', padding: spacing.sm }}><Pressable onPress={onClose} style={{ padding: spacing.sm }}><Ionicons color={colors.textPrimary} name="arrow-back" size={26} /></Pressable><AppText variant="subtitle" weight="900">Mesaj Bilgisi</AppText></View><View style={{ gap: spacing.lg, padding: spacing.md }}><View style={{ backgroundColor: colors.surfaceElevated, borderRadius: radii.md, padding: spacing.md }}><AppText color="muted" variant="caption">Okuyanlar · {readers.length}</AppText></View>{readers.length ? readers.map(({ cursor, member }) => <View key={member.userId} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}><Avatar accessibilityLabel={`${member.firstName} profil fotoğrafı`} imageURL={null} initials={member.firstName.charAt(0)} size={44} /><AppText style={{ flex: 1 }} weight="800">{member.firstName}</AppText><AppText color="muted" variant="caption">{cursor.lastReadAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</AppText></View>) : <AppText color="muted">Henüz okuyan yok.</AppText>}</View></SafeAreaView></Modal>;
}

export function GroupChat({ group, onBack, userId }: { group: DevreGroup; onBack?: () => void; userId: string }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<DevreChatMessage>>(null);
  const lastComposerHeightRef = useRef(64);
  const nearLatestRef = useRef(true);
  const [nearLatest, setNearLatest] = useState(true);
  const initializedRef = useRef(false);
  const loadedOlderRef = useRef(false);
  const [messages, setMessages] = useState<DevreChatMessage[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [cursors, setCursors] = useState<DevreGroupReadCursor[]>([]);
  const [cursor, setCursor] = useState<DevreChatCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState<SelectedChatImage | null>(null);
  const [caption, setCaption] = useState('');
  const [previewSending, setPreviewSending] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<DevreChatMessage | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DevreChatMessage | null>(null);
  const [infoMessage, setInfoMessage] = useState<DevreChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<DevreChatMessage | null>(null);
  const extraContentPadding = useSharedValue(0);
  const profiles = useMemo(() => new Map(group.members.map((member) => [member.userId, member])), [group.members]);
  const visibleMessages = useMemo(() => messages.filter((message) => !hiddenIds.has(message.id)), [hiddenIds, messages]);
  const messagesById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const renderScrollComponent = useCallback((props: ScrollViewProps) => <ChatScrollView {...props} extraContentPadding={extraContentPadding} />, [extraContentPadding]);
  const handleComposerLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (height === lastComposerHeightRef.current) return;
    lastComposerHeightRef.current = height;
    extraContentPadding.set(withTiming(Math.max(height - 64, 0), { duration: 140 }));
  }, [extraContentPadding]);

  const loadHidden = useCallback((items: readonly DevreChatMessage[]) => {
    void fetchHiddenGroupMessageIds(userId, group.groupId, items.map((item) => item.id)).then((ids) => {
      if (!ids.size) return;
      setHiddenIds((current) => new Set([...current, ...ids]));
    }).catch(() => undefined);
  }, [group.groupId, userId]);
  useEffect(() => { setActiveDevreGroupChatId(group.groupId); return () => setActiveDevreGroupChatId(null); }, [group.groupId]);
  useEffect(() => subscribeToGroupReadCursors(group.groupId, setCursors), [group.groupId]);
  useEffect(() => subscribeToRecentDevreChatMessages(group.groupId, (page) => {
    loadHidden(page.messages);
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      const unseen = page.messages.filter((message) => message.senderUid !== userId && !known.has(message.id)).length;
      if (initializedRef.current && unseen && !nearLatestRef.current) {
        setNearLatest(false);
        setNewCount((count) => count + unseen);
      }
      return mergeDevreChatMessages(current, page.messages);
    });
    if (!loadedOlderRef.current) { setCursor(page.cursor); setHasMore(page.hasMore); }
    initializedRef.current = true; setError(null);
  }, (caughtError) => {
    if (isPermissionDenied(caughtError)) { setMessages([]); setAccessLost(true); setError('Bu Devre grubuna erişimin sona erdi.'); }
    else setError('Sohbet bağlantısı kesildi. İnternet bağlantını kontrol edip tekrar dene.');
  }), [group.groupId, loadHidden, userId]);
  useEffect(() => {
    const latest = visibleMessages[0];
    if (!latest || !nearLatest) return undefined;
    const timeout = setTimeout(() => void markDevreGroupRead(userId, group.groupId, latest).catch(() => undefined), 600);
    return () => clearTimeout(timeout);
  }, [group.groupId, nearLatest, userId, visibleMessages]);
  useEffect(() => {
    if (newCount === 0 && nearLatestRef.current) setNearLatest(true);
  }, [newCount]);

  const persist = useCallback(async (message: DevreChatMessage) => {
    setMessages((current) => mergeDevreChatMessages(current, [message]));
    try {
      if (message.type !== 'text') {
        await uploadAndSendDevreChatMediaMessage(group.groupId, message);
      } else {
        await sendDevreChatMessage(group.groupId, message);
      }
    } catch (caughtError: unknown) {
      setMessages((current) => updateDevreChatMessageStatus(current, message.id, 'failed'));
      if (isPermissionDenied(caughtError)) { setMessages([]); setAccessLost(true); setError('Bu Devre grubuna erişimin sona erdi.'); }
    }
  }, [group.groupId]);
  const sendText = useCallback((text: string) => { nearLatestRef.current = true; setNearLatest(true); void persist(createDevreChatMessageDraft(group.groupId, userId, text, replyingTo?.id ?? null)); setReplyingTo(null); listRef.current?.scrollToOffset({ animated: true, offset: 0 }); }, [group.groupId, persist, replyingTo?.id, userId]);
  const sendDocument = useCallback((document: SelectedChatDocument) => { const id = createDevreChatMessageId(group.groupId); void persist(createDocumentMessageDraft({ ...document, groupId: group.groupId, localMediaUri: document.uri, messageId: id, replyToMessageId: replyingTo?.id, senderUid: userId })); setReplyingTo(null); }, [group.groupId, persist, replyingTo?.id, userId]);
  const sendImage = async () => {
    if (!preview) return; setPreviewSending(true);
    try { const prepared = await prepareChatImage(preview); const id = createDevreChatMessageId(group.groupId); const draft = createImageMessageDraft({ caption, groupId: group.groupId, height: prepared.height, localMediaUri: prepared.uri, messageId: id, replyToMessageId: replyingTo?.id, senderUid: userId, width: prepared.width }); setPreview(null); setCaption(''); setReplyingTo(null); void persist(draft); }
    catch { setError('Fotoğraf hazırlanamadı. Lütfen başka bir fotoğrafla tekrar dene.'); }
    finally { setPreviewSending(false); }
  };
  const pickGallery = () => void selectChatPhoto().then((image) => { if (image) setPreview(image); }).catch(() => setError('Galeri açılamadı. Fotoğraf iznini kontrol et.'));
  const pickDocument = () => void selectChatDocument().then((document) => { if (document) sendDocument(document); }).catch((caught: unknown) => setError(caught instanceof Error && caught.message === 'document-too-large' ? 'Belge en fazla 20 MB olabilir.' : 'Yalnızca PDF, Word, Excel ve PowerPoint belgeleri desteklenir.'));
  const loadOlder = useCallback(async () => { if (!cursor || !hasMore || loadingOlder) return; setLoadingOlder(true); try { const page = await fetchOlderDevreChatMessages(group.groupId, cursor); loadHidden(page.messages); loadedOlderRef.current = true; setMessages((current) => mergeDevreChatMessages(current, page.messages)); setCursor(page.cursor); setHasMore(page.hasMore); } catch { setError('Eski mesajlar yüklenemedi.'); } finally { setLoadingOlder(false); } }, [cursor, group.groupId, hasMore, loadHidden, loadingOlder]);
  const hideSelected = (message: DevreChatMessage) => void hideGroupMessageForUser(userId, group.groupId, message.id).then(() => setHiddenIds((current) => new Set([...current, message.id]))).catch(() => setError('Mesaj gizlenemedi.'));
  const deleteForEveryone = (message: DevreChatMessage) => void deleteGroupMessageForEveryone(group.groupId, message.id, userId).catch(() => setError('Mesaj silinemedi.'));
  const messageActions: ChatSheetAction[] = (() => {
    if (!selectedMessage) return [];
    const own = selectedMessage.senderUid === userId;
    return [
      ...(own && selectedMessage.status === 'sent' ? [{ icon: 'information-circle-outline' as const, label: 'Bilgi', onPress: () => setInfoMessage(selectedMessage) }] : []),
      ...(selectedMessage.type === 'text' && !selectedMessage.deletedForEveryone ? [{ icon: 'copy-outline' as const, label: 'Kopyala', onPress: () => void Clipboard.setStringAsync(selectedMessage.text) }] : []),
      { icon: 'return-up-back-outline' as const, label: 'Yanıtla', onPress: () => setReplyingTo(selectedMessage) },
      { icon: 'eye-off-outline' as const, label: 'Benden Sil', onPress: () => hideSelected(selectedMessage) },
      ...(own && selectedMessage.status === 'sent' && !selectedMessage.deletedForEveryone ? [{ destructive: true, icon: 'trash-outline' as const, label: 'Herkesten Sil', onPress: () => setDeleteConfirmation(selectedMessage) }] : []),
    ];
  })();
  const attachmentActions: ChatSheetAction[] = [
    { icon: 'camera-outline', label: 'Kamera', onPress: () => setCameraOpen(true) },
    { icon: 'images-outline', label: 'Galeri', onPress: pickGallery },
    { icon: 'document-text-outline', label: 'Belge', onPress: pickDocument },
  ];
  return <SafeAreaView edges={['top']} style={{ backgroundColor: colors.chatBackground, flex: 1 }}>
    <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 58, paddingHorizontal: spacing.sm }}>
      <Pressable accessibilityLabel="Geri dön" onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chats'))} style={{ alignItems: 'center', height: 48, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textPrimary} name="arrow-back" size={25} /></Pressable>
      <Pressable onPress={() => router.push({ pathname: '/group-info/[groupId]', params: { groupId: group.groupId } })} style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm }}><Avatar accessibilityLabel="Devre grubu" imageURL={null} initials={(group.militaryUnitName ?? 'D').charAt(0)} size={42} /><View style={{ flex: 1 }}><AppText numberOfLines={1} weight="900">{group.militaryUnitName ?? 'Devre Grubu'}</AppText><AppText color="muted" variant="caption">{group.members.length} üye</AppText></View></Pressable>
      <Pressable accessibilityLabel="Grup bilgisi" onPress={() => router.push({ pathname: '/group-info/[groupId]', params: { groupId: group.groupId } })} style={{ alignItems: 'center', height: 48, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textPrimary} name="ellipsis-vertical" size={22} /></Pressable>
    </View>
    {error ? <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.sm }}><AppText color="danger" variant="caption">{error}</AppText></View> : null}
    <View style={{ flex: 1 }}>
      <KeyboardGestureArea enableSwipeToDismiss={Platform.OS !== 'android'} interpolator="ios" offset={64} style={{ flex: 1 }} textInputNativeID="devre-group-chat-input">
      <FlatList ref={listRef} contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.md, paddingHorizontal: spacing.md, paddingTop: 64 + spacing.md }} data={visibleMessages} inverted keyboardShouldPersistTaps="handled" keyExtractor={(message) => message.id} onEndReached={() => void loadOlder()} onEndReachedThreshold={0.25} onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => { const near = event.nativeEvent.contentOffset.y < 80; nearLatestRef.current = near; if (near) setNewCount(0); }} onScrollToIndexFailed={({ index }) => listRef.current?.scrollToOffset({ animated: true, offset: Math.max(0, index * 72) })} renderScrollComponent={renderScrollComponent} scrollEventThrottle={100} ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: spacing.xl }}><AppText weight="800">{accessLost ? 'Sohbet erişimi kapandı' : 'Henüz mesaj yok.'}</AppText><AppText color="muted">{accessLost ? 'Güncel grubun hazır olduğunda burada görünecek.' : 'İlk mesajı sen gönder.'}</AppText></View>} ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} /> : null} renderItem={({ item, index }) => { const replyMessage = item.replyToMessageId ? messagesById.get(item.replyToMessageId) ?? null : null; const replyIndex = item.replyToMessageId ? visibleMessages.findIndex((message) => message.id === item.replyToMessageId) : -1; return <MessageRow current={item} groupId={group.groupId} onLongPress={() => setSelectedMessage(item)} onOpenImage={setViewerUri} onOpenReply={() => { if (replyIndex >= 0) listRef.current?.scrollToIndex({ animated: true, index: replyIndex, viewPosition: 0.5 }); }} onReply={() => setReplyingTo(item)} onRetry={() => void persist({ ...item, status: 'pending' })} own={item.senderUid === userId} profile={profiles.get(item.senderUid) ?? null} readByOthers={cursors.some((read) => read.uid !== userId && item.createdAt && read.lastReadMessageCreatedAt.getTime() >= item.createdAt.getTime())} replyMessage={replyMessage} replySender={replyMessage ? (profiles.get(replyMessage.senderUid)?.firstName ?? 'Devre') : null} showDate={shouldShowDateSeparator(visibleMessages[index + 1], item)} showIdentity={!isSameMessageCluster(visibleMessages[index + 1], item)} />; }} />
      {newCount ? <Pressable onPress={() => { listRef.current?.scrollToOffset({ animated: true, offset: 0 }); setNewCount(0); }} style={{ alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 999, bottom: 74, padding: spacing.sm, position: 'absolute' }}><AppText style={{ color: colors.textInverse }} weight="800">{newCount} yeni mesaj</AppText></Pressable> : null}
      <KeyboardStickyView offset={{ closed: 0, opened: Math.max(insets.bottom - 8, 0) }} style={{ bottom: 0, left: 0, position: 'absolute', right: 0 }}>
        <ChatComposer disabled={accessLost} nativeID="devre-group-chat-input" onAttachment={() => setAttachmentOpen(true)} onInputLayout={handleComposerLayout} onSend={sendText} onStopReply={() => setReplyingTo(null)} replyPreview={replyingTo ? getDevreChatMessagePreview(replyingTo) : null} replySender={replyingTo ? (profiles.get(replyingTo.senderUid)?.firstName ?? 'Devre') : null} />
      </KeyboardStickyView>
      </KeyboardGestureArea>
    </View>
    <ChatBottomSheet actions={attachmentActions} onClose={() => setAttachmentOpen(false)} title="Ekle" visible={attachmentOpen} />
    <ChatBottomSheet actions={messageActions} onClose={() => setSelectedMessage(null)} visible={Boolean(selectedMessage)} />
    <ChatBottomSheet actions={deleteConfirmation ? [{ destructive: true, icon: 'trash-outline', label: 'Herkes için sil', onPress: () => { deleteForEveryone(deleteConfirmation); setDeleteConfirmation(null); } }] : []} onClose={() => setDeleteConfirmation(null)} title="Bu mesaj herkesten silinsin mi?" visible={Boolean(deleteConfirmation)} />
    <ChatCameraModal onClose={() => setCameraOpen(false)} onPhoto={(photo) => { setCameraOpen(false); setPreview(photo); }} visible={cameraOpen} />
    <PhotoPreview caption={caption} image={preview} onCaption={setCaption} onClose={() => { setPreview(null); setCaption(''); }} onSend={() => void sendImage()} sending={previewSending} />
    <Modal animationType="fade" onRequestClose={() => setViewerUri(null)} visible={Boolean(viewerUri)}><SafeAreaView style={{ backgroundColor: '#000', flex: 1 }}><Pressable accessibilityLabel="Fotoğrafı kapat" onPress={() => setViewerUri(null)} style={{ alignSelf: 'flex-start', padding: spacing.md }}><Ionicons color="#fff" name="close" size={30} /></Pressable>{viewerUri ? <Image resizeMode="contain" source={{ uri: viewerUri }} style={{ flex: 1, width: '100%' }} /> : null}</SafeAreaView></Modal>
    <MessageInfoModal cursors={cursors} group={group} message={infoMessage} onClose={() => setInfoMessage(null)} />
  </SafeAreaView>;
}
