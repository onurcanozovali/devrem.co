import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardController } from 'react-native-keyboard-controller';
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { DevremConfirmModal } from '@/components/ui/DevremConfirmModal';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ChatBottomSheet, type ChatSheetAction } from '@/features/groups/ChatBottomSheet';
import { ChatCameraModal } from '@/features/groups/ChatCameraModal';
import { ChatComposer } from '@/features/groups/ChatComposer';
import { ChatImageViewer, type ChatViewerImage } from '@/features/groups/ChatImageViewer';
import { selectChatDocument, type SelectedChatDocument } from '@/features/groups/chatDocuments';
import { prepareChatImage, selectChatPhoto, type SelectedChatImage } from '@/features/groups/chatMedia';
import {
  collapseDevreChatText, formatChatDate, getDevreChatMessagePreview, mergeDevreChatMessages,
  shouldShowDateSeparator, updateDevreChatMessageStatus, type DevreChatMessage,
} from '@/features/groups/chatDomain';
import { openLocalChatDocument } from '@/features/groups/documentOpen';
import { shouldTriggerSwipeReply } from '@/features/groups/chatRuntime';
import { useChatKeyboardOffset } from '@/features/groups/useChatKeyboardOffset';
import type { PublicProfile } from '@/features/matching/types/discovery';
import { getPublicProfileDisplayName } from '@/features/matching/services/discoveryDomain';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import {
  blockDirectMessageUser, createDirectDocumentMessageDraft, createDirectImageMessageDraft, createDirectMessageId,
  createDirectTextMessageDraft, deleteDirectMessageForEveryone, fetchDirectConversation, fetchHiddenDirectMessageIds, fetchOlderDirectMessages, fetchPublicProfile,
  hideDirectConversation, hideDirectMessageForUser,
  markDirectConversationRead, reportDirectMessageUser, resolveDirectChatMediaLocalUri,
  sendDirectMessage, subscribeToDirectBlockState,
  subscribeToDirectMessages, subscribeToDirectParticipantState, subscribeToDirectReadCursor, unblockDirectMessageUser, type DirectMessage,
} from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { forgetVisibleDirectConversation, getCachedDirectRecipientUid } from './directConversationCache';
import { DevremReportSheet } from './DevremReportSheet';

function messageTime(message: DirectMessage) {
  return (message.createdAt ?? message.clientCreatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const DirectMediaImage = memo(function DirectMediaImage({ conversationId, message, onOpen }: { conversationId: string; message: Extract<DirectMessage, { type: 'image' }>; onOpen: (image: ChatViewerImage) => void }) {
  const { colors, radii } = useTheme();
  const [uri, setUri] = useState(message.localMediaUri ?? '');
  useEffect(() => {
    if (uri) return;
    let active = true;
    void resolveDirectChatMediaLocalUri(conversationId, message.id, 'image', message.mediaPath).then((value) => { if (active) setUri(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [conversationId, message.id, message.mediaPath, uri]);
  return <Pressable disabled={!uri} onPress={() => uri && onOpen({ height: message.height, messageId: message.id, uri, width: message.width })}>
    <View style={{ alignItems: 'center', aspectRatio: Math.max(0.6, Math.min(1.8, message.width / message.height)), backgroundColor: colors.surfaceSecondary, borderRadius: radii.sm, justifyContent: 'center', overflow: 'hidden', width: 230 }}>
      {uri ? <Image fadeDuration={0} resizeMode="cover" source={{ uri }} style={{ height: '100%', width: '100%' }} /> : <ActivityIndicator color={colors.primary} />}
    </View>
  </Pressable>;
});

const DirectDocument = memo(function DirectDocument({ conversationId, message, onError, textColor }: { conversationId: string; message: Extract<DirectMessage, { type: 'document' }>; onError: (message: string) => void; textColor: string }) {
  const { colors, radii, spacing } = useTheme();
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const uri = message.localMediaUri ?? await resolveDirectChatMediaLocalUri(conversationId, message.id, 'document', message.mediaPath, message.extension);
      await openLocalChatDocument(uri, message.mimeType);
    } catch { onError('Belge açılamadı. İnternet bağlantını ve belge görüntüleyicini kontrol et.'); }
    finally { setOpening(false); }
  };
  return <Pressable onPress={() => void open()} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 230 }}>
    <View style={{ alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, height: 46, justifyContent: 'center', width: 46 }}>{opening ? <ActivityIndicator color={colors.primary} /> : <Ionicons color={colors.primary} name="document-text" size={25} />}</View>
    <View style={{ flex: 1 }}><AppText numberOfLines={2} style={{ color: textColor }} weight="800">{message.fileName}</AppText><AppText variant="caption" style={{ color: textColor, opacity: 0.72 }}>{Math.ceil(message.sizeBytes / 1024)} KB · {message.extension.toUpperCase()}</AppText></View>
  </Pressable>;
});

const DirectMessageRow = memo(function DirectMessageRow({ conversationId, highlighted, message, onError, onLongPress, onOpenImage, onOpenReply, onReply, onRetry, own, read, reply, showDate }: {
  conversationId: string; message: DirectMessage; onLongPress: (message: DirectMessage) => void; onOpenImage: (image: ChatViewerImage) => void;
  highlighted: boolean; onError: (message: string) => void; onOpenReply: (messageId: string) => void; onReply: (message: DirectMessage) => void;
  onRetry: (message: DirectMessage) => void; own: boolean; read: boolean; reply: DirectMessage | null; showDate: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const translateX = useSharedValue(0);
  const triggerReply = useCallback(() => onReply(message), [message, onReply]);
  const triggerLongPress = useCallback(() => onLongPress(message), [message, onLongPress]);
  const pan = useMemo(() => Gesture.Pan().activeOffsetX(10).failOffsetX(-10).failOffsetY([-12, 12]).onUpdate((event) => translateX.set(Math.min(72, Math.max(0, event.translationX))))
    .onEnd((event) => { if (shouldTriggerSwipeReply(event.translationX, own)) runOnJS(triggerReply)(); }).onFinalize(() => translateX.set(withTiming(0, { duration: 160 }))), [own, translateX, triggerReply]);
  const longPress = useMemo(() => Gesture.LongPress().minDuration(420).maxDistance(12).onStart(() => runOnJS(triggerLongPress)()), [triggerLongPress]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));
  const bubble = own ? colors.chatBubbleMine : colors.chatBubbleOther;
  const textColor = own ? colors.chatTextMine : colors.chatTextOther;
  const timestamp = own ? colors.chatTimestampMine : colors.chatTimestampOther;
  const [expanded, setExpanded] = useState(false);
  const collapsed = message.type === 'text' ? collapseDevreChatText(message.text) : null;
  const status = <View style={{ alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 3, marginLeft: spacing.sm }}><AppText variant="caption" style={{ color: timestamp }}>{messageTime(message)}</AppText>{own && message.status === 'pending' ? <Ionicons color={timestamp} name="time-outline" size={15} /> : null}{own && message.status === 'sent' ? <Ionicons color={read ? colors.primary : timestamp} name={read ? 'checkmark-done' : 'checkmark'} size={16} /> : null}{own && message.status === 'failed' ? <Ionicons color={colors.danger} name="alert-circle" size={16} /> : null}</View>;
  return <View>
    {showDate ? <View style={{ alignItems: 'center', marginVertical: spacing.md }}><View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}><AppText color="muted" variant="caption" weight="800">{formatChatDate(message.createdAt ?? message.clientCreatedAt)}</AppText></View></View> : null}
    <GestureDetector gesture={Gesture.Race(pan, longPress)}><Reanimated.View style={[{ alignItems: own ? 'flex-end' : 'flex-start', backgroundColor: highlighted ? colors.primarySubtle : 'transparent', marginBottom: 3, width: '100%' }, style]}>
    <View style={{ alignSelf: own ? 'flex-end' : 'flex-start', backgroundColor: bubble, borderColor: own ? bubble : colors.border, borderRadius: radii.md, borderWidth: 1, maxWidth: '84%', minWidth: 76, padding: message.type === 'image' && !message.deletedForEveryone ? 4 : spacing.sm }}>
      {reply ? <Pressable onPress={() => onOpenReply(reply.id)} style={{ borderLeftColor: colors.primary, borderLeftWidth: 4, marginBottom: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}><AppText style={{ color: colors.primary }} variant="caption" weight="900">Yanıt</AppText><AppText color="muted" numberOfLines={2} variant="caption">{getDevreChatMessagePreview(reply)}</AppText></Pressable> : null}
      {message.deletedForEveryone ? <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}><Ionicons color={colors.chatDeletedText} name="ban-outline" size={18} /><AppText style={{ color: colors.chatDeletedText, fontStyle: 'italic' }}>Bu mesaj silindi</AppText>{status}</View> : <>
        {message.type === 'text' ? <View style={{ alignItems: 'flex-end', flexDirection: 'row' }}><View style={{ flexShrink: 1 }}><AppText style={{ color: textColor }}>{collapsed && !expanded ? collapsed : message.text}</AppText>{collapsed ? <Pressable onPress={() => setExpanded((value) => !value)}><AppText variant="caption" weight="900" style={{ color: textColor }}>{expanded ? 'Daha az göster' : 'Devamını oku'}</AppText></Pressable> : null}</View>{status}</View> : null}
        {message.type === 'image' ? <><DirectMediaImage conversationId={conversationId} message={message} onOpen={onOpenImage} />{message.caption ? <AppText style={{ color: textColor, paddingHorizontal: 4, paddingTop: spacing.xs }}>{message.caption}</AppText> : null}{status}</> : null}
        {message.type === 'document' ? <><DirectDocument conversationId={conversationId} message={message} onError={onError} textColor={textColor} />{status}</> : null}
      </>}
    </View>
    {message.status === 'failed' ? <Pressable accessibilityRole="button" onPress={() => onRetry(message)} style={{ alignSelf: own ? 'flex-end' : 'flex-start', minHeight: 34, justifyContent: 'center' }}><AppText color="danger" variant="caption" weight="800">Tekrar dene</AppText></Pressable> : null}
  </Reanimated.View></GestureDetector>
  </View>;
});

function PhotoPreview({ caption, image, onCaption, onClose, onSend, sending }: { caption: string; image: SelectedChatImage | null; onCaption: (value: string) => void; onClose: () => void; onSend: () => void; sending: boolean }) {
  const { colors, spacing } = useTheme();
  return <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(image)}><SafeAreaView style={{ backgroundColor: '#050706', flex: 1 }}><View style={{ alignItems: 'center', flexDirection: 'row', padding: spacing.sm }}><Pressable onPress={onClose} style={{ padding: spacing.md }}><Ionicons color="#fff" name="close" size={28} /></Pressable><AppText style={{ color: '#fff', flex: 1 }} weight="900">Fotoğraf Önizleme</AppText></View>{image ? <Image resizeMode="contain" source={{ uri: image.uri }} style={{ flex: 1, width: '100%' }} /> : null}<View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}><TextInput maxLength={1500} onChangeText={onCaption} placeholder="Bir açıklama ekle…" placeholderTextColor="#aaa" style={{ backgroundColor: '#202321', borderRadius: 23, color: '#fff', flex: 1, minHeight: 48, padding: spacing.md }} value={caption} /><Pressable disabled={sending} onPress={onSend} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 }}>{sending ? <ActivityIndicator color="#fff" /> : <Ionicons color={colors.textInverse} name="send" size={22} />}</Pressable></View></SafeAreaView></Modal>;
}

export function DirectChatScreen() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
  const { session } = useAuth();
  const { colors, spacing } = useTheme();
  const keyboardHeight = useChatKeyboardOffset();
  const layoutStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -keyboardHeight.get() }] }));
  const [recipient, setRecipient] = useState<PublicProfile | null>(null);
  const [recipientUid, setRecipientUid] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const messagesRef = useRef<DirectMessage[]>([]);
  const replaceMessages = useCallback((update: (current: DirectMessage[]) => DirectMessage[]) => {
    const next = update(messagesRef.current);
    messagesRef.current = next;
    setMessages(next);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [selected, setSelected] = useState<DirectMessage | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState<SelectedChatImage | null>(null);
  const [caption, setCaption] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const [viewer, setViewer] = useState<ChatViewerImage | null>(null);
  const [otherReadAt, setOtherReadAt] = useState<Date | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [messagingAllowed, setMessagingAllowed] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null | undefined>(undefined);
  const [confirmation, setConfirmation] = useState<'block' | 'unblock' | 'deleteConversation' | null>(null);
  const [privacyActionLoading, setPrivacyActionLoading] = useState(false);
  const [privacyActionError, setPrivacyActionError] = useState<string | null>(null);
  const [messageDeletion, setMessageDeletion] = useState<{ messageId: string; scope: 'self' | 'everyone' } | null>(null);
  const [messageDeletionLoading, setMessageDeletionLoading] = useState(false);
  const [messageDeletionError, setMessageDeletionError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState(new Set<string>());
  const hiddenLookupIdsRef = useRef(new Set<string>());
  const hiddenLookupVersionRef = useRef(0);
  const lastReadRequestRef = useRef('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const photoURL = useProfilePhotoURL(recipient?.userId ?? '', recipient?.photoPath ?? null, recipient?.updatedAt ?? null);

  useEffect(() => {
    if (!session || !conversationId) return;
    let active = true;
    const cachedRecipientUid = getCachedDirectRecipientUid(conversationId, session.userId);
    if (cachedRecipientUid) {
      void fetchPublicProfile(cachedRecipientUid).then((profile) => {
        if (!active) return;
        setRecipientUid(cachedRecipientUid);
        setRecipient(profile);
      }).catch(() => {
        if (active) setRecipientUid(cachedRecipientUid);
      });
      return () => { active = false; };
    }
    void fetchDirectConversation(conversationId).then(async (conversation) => {
      if (!conversation || !conversation.participantUids.includes(session.userId)) throw new Error('not-participant');
      const otherUid = conversation.participantUids.find((uid) => uid !== session.userId) ?? '';
      const profile = await fetchPublicProfile(otherUid);
      if (!active) return;
      setRecipientUid(otherUid); setRecipient(profile);
    }).catch(() => { if (active) setError('Bu özel sohbete erişimin yok.'); });
    return () => { active = false; };
  }, [conversationId, session]);
  useEffect(() => conversationId ? subscribeToDirectMessages(
    conversationId,
    (incoming) => replaceMessages((current) => mergeDevreChatMessages(current, incoming) as DirectMessage[]),
    () => setError('Sohbet bağlantısı kesildi.'),
  ) : undefined, [conversationId, replaceMessages]);
  useEffect(() => {
    const latest = messages[0];
    const requestKey = latest ? `${conversationId}:${latest.id}` : '';
    if (!session || !latest || latest.senderUid === session.userId || lastReadRequestRef.current === requestKey) return;
    lastReadRequestRef.current = requestKey;
    void markDirectConversationRead(conversationId, session.userId, latest).catch(() => {
      if (lastReadRequestRef.current === requestKey) lastReadRequestRef.current = '';
    });
  }, [conversationId, messages, session]);
  useEffect(() => recipientUid ? subscribeToDirectReadCursor(conversationId, recipientUid, setOtherReadAt) : undefined, [conversationId, recipientUid]);
  useEffect(() => session && recipientUid ? subscribeToDirectBlockState(session.userId, recipientUid, (value) => {
    setBlocked(value);
    if (value) { setReplyingTo(null); setAttachmentOpen(false); setPreview(null); }
  }) : undefined, [recipientUid, session]);
  useEffect(() => session ? subscribeToDirectParticipantState(conversationId, session.userId, (state) => {
    setMessagingAllowed(state.messagingAllowed);
    if (!state.messagingAllowed) { setReplyingTo(null); setAttachmentOpen(false); setPreview(null); }
  }) : undefined, [conversationId, session]);
  useEffect(() => {
    hiddenLookupVersionRef.current += 1;
    hiddenLookupIdsRef.current.clear();
    lastReadRequestRef.current = '';
  }, [conversationId]);
  useEffect(() => {
    if (!session || !messages.length) return;
    const unqueriedIds = messages.map((message) => message.id).filter((id) => !hiddenLookupIdsRef.current.has(id));
    if (!unqueriedIds.length) return;
    unqueriedIds.forEach((id) => hiddenLookupIdsRef.current.add(id));
    const requestVersion = hiddenLookupVersionRef.current;
    void fetchHiddenDirectMessageIds(session.userId, conversationId, unqueriedIds).then((ids) => {
      if (requestVersion !== hiddenLookupVersionRef.current || !ids.size) return;
      setHiddenIds((current) => new Set([...current, ...ids]));
    }).catch(() => {
      if (requestVersion === hiddenLookupVersionRef.current) {
        unqueriedIds.forEach((id) => hiddenLookupIdsRef.current.delete(id));
      }
    });
  }, [conversationId, messages, session]);

  const byId = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const visibleMessages = useMemo(() => messages.filter((message) => !hiddenIds.has(message.id)), [hiddenIds, messages]);
  const reply = useCallback((message: DirectMessage) => { setReplyingTo(message); setFocusRequest((value) => value + 1); }, []);
  const persist = useCallback(async (message: DirectMessage) => {
    replaceMessages((current) => mergeDevreChatMessages(current, [message]) as DirectMessage[]);
    setError(null);
    try {
      await sendDirectMessage(conversationId, message);
    } catch {
      replaceMessages((current) => updateDevreChatMessageStatus(current, message.id, 'failed') as DirectMessage[]);
      setError(message.type === 'image'
        ? 'Fotoğraf gönderilemedi. Mesajın altındaki “Tekrar dene” seçeneğini kullanabilirsin.'
        : message.type === 'document'
          ? 'Belge gönderilemedi. Mesajın altındaki “Tekrar dene” seçeneğini kullanabilirsin.'
          : 'Mesaj gönderilemedi. Tekrar dene.');
    }
  }, [conversationId, replaceMessages]);
  const sendText = useCallback((text: string) => {
    if (!session) return;
    void persist(createDirectTextMessageDraft(conversationId, session.userId, text, replyingTo?.id ?? null));
    setReplyingTo(null);
  }, [conversationId, persist, replyingTo?.id, session]);
  const sendDocument = useCallback((document: SelectedChatDocument) => {
    if (!session) return;
    const messageId = createDirectMessageId(conversationId);
    void persist(createDirectDocumentMessageDraft({
      ...document,
      conversationId,
      localMediaUri: document.uri,
      messageId,
      replyToMessageId: replyingTo?.id ?? null,
      senderUid: session.userId,
    }));
    setReplyingTo(null);
  }, [conversationId, persist, replyingTo?.id, session]);
  const sendImage = async () => {
    if (!preview || !session) return; setSendingImage(true);
    try {
      const image = await prepareChatImage(preview);
      const messageId = createDirectMessageId(conversationId);
      const draft = createDirectImageMessageDraft({ caption, conversationId, height: image.height, localMediaUri: image.uri, messageId, replyToMessageId: replyingTo?.id ?? null, senderUid: session.userId, width: image.width });
      setPreview(null); setCaption(''); setReplyingTo(null);
      void persist(draft);
    } catch { setError('Fotoğraf hazırlanamadı. Lütfen başka bir fotoğrafla tekrar dene.'); } finally { setSendingImage(false); }
  };
  const retryMessage = useCallback((message: DirectMessage) => {
    void persist({ ...message, status: 'pending' });
  }, [persist]);
  const runPrivacyAction = async () => {
    if (!session || !recipientUid || !confirmation || privacyActionLoading) return;
    setPrivacyActionLoading(true); setPrivacyActionError(null);
    try {
      if (confirmation === 'block') await blockDirectMessageUser(session.userId, recipientUid);
      if (confirmation === 'unblock') await unblockDirectMessageUser(session.userId, recipientUid);
      if (confirmation === 'deleteConversation') {
        await hideDirectConversation(session.userId, conversationId);
        forgetVisibleDirectConversation(session.userId, recipientUid);
        setConfirmation(null);
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/chats');
        return;
      }
      setConfirmation(null);
    } catch {
      setPrivacyActionError('İşlem tamamlanamadı. Tekrar dene.');
    } finally { setPrivacyActionLoading(false); }
  };
  const submitReport = async (reason: Parameters<typeof reportDirectMessageUser>[0]['reason']) => {
    if (!session || !recipientUid) throw new Error('missing-report-target');
    await reportDirectMessageUser({ conversationId, messageId: reportTargetMessageId ?? null, reason, reportedUid: recipientUid, reporterUid: session.userId });
  };
  const runMessageDeletion = async () => {
    if (!session || !messageDeletion || messageDeletionLoading) return;
    setMessageDeletionLoading(true); setMessageDeletionError(null);
    try {
      if (messageDeletion.scope === 'self') {
        await hideDirectMessageForUser(session.userId, conversationId, messageDeletion.messageId);
        setHiddenIds((current) => new Set([...current, messageDeletion.messageId]));
      } else {
        await deleteDirectMessageForEveryone(conversationId, messageDeletion.messageId, session.userId);
      }
      setMessageDeletion(null);
    } catch { setMessageDeletionError('Mesaj silinemedi. Tekrar dene.'); }
    finally { setMessageDeletionLoading(false); }
  };
  const openReply = (messageId: string) => {
    const index = visibleMessages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId((current) => current === messageId ? null : current), 1400);
  };
  const loadOlder = async () => {
    const oldest = messages.at(-1);
    const before = oldest?.createdAt ?? oldest?.clientCreatedAt;
    if (!before || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchOlderDirectMessages(conversationId, before);
      replaceMessages((current) => mergeDevreChatMessages(current, page.messages) as DirectMessage[]);
      setHasMore(page.hasMore);
    } catch { setError('Eski mesajlar yüklenemedi.'); }
    finally { setLoadingOlder(false); }
  };
  const actions: ChatSheetAction[] = selected ? [
    ...(selected.type === 'text' && !selected.deletedForEveryone ? [{ icon: 'copy-outline' as const, label: 'Kopyala', onPress: () => void Clipboard.setStringAsync(selected.text) }] : []),
    { icon: 'return-up-back-outline', label: 'Yanıtla', onPress: () => reply(selected) },
    { icon: 'eye-off-outline', label: 'Benden Sil', onPress: () => { setMessageDeletionError(null); setMessageDeletion({ messageId: selected.id, scope: 'self' }); } },
    ...(selected.senderUid !== session?.userId ? [{ icon: 'flag-outline' as const, label: 'Mesajı bildir', onPress: () => setReportTargetMessageId(selected.id) }] : []),
    ...(selected.senderUid === session?.userId && !selected.deletedForEveryone ? [{ destructive: true, icon: 'trash-outline' as const, label: 'Herkesten Sil', onPress: () => { setMessageDeletionError(null); setMessageDeletion({ messageId: selected.id, scope: 'everyone' }); } }] : []),
  ] : [];
  const pickGallery = () => void selectChatPhoto()
    .then((image) => { if (image) setPreview(image); })
    .catch(() => setError('Galeri açılamadı. Fotoğraf iznini kontrol et.'));
  const pickDocument = () => void selectChatDocument()
    .then((document) => { if (document) sendDocument(document); })
    .catch((caught: unknown) => setError(caught instanceof Error && caught.message === 'document-too-large'
      ? 'Belge en fazla 20 MB olabilir.'
      : 'Yalnızca PDF, Word, Excel ve PowerPoint belgeleri desteklenir.'));
  const attachmentActions: ChatSheetAction[] = [
    { icon: 'camera-outline', label: 'Kamera', onPress: () => setCameraOpen(true) },
    { icon: 'images-outline', label: 'Galeri', onPress: pickGallery },
    { icon: 'document-text-outline', label: 'Belge', onPress: pickDocument },
  ];
  const title = recipient ? getPublicProfileDisplayName(recipient) : 'Silinmiş kullanıcı';
  const userActions: ChatSheetAction[] = [
    { icon: 'flag-outline', label: 'Kullanıcıyı bildir', onPress: () => setReportTargetMessageId(null) },
    blocked
      ? { icon: 'lock-open-outline', label: 'Engeli kaldır', onPress: () => { setPrivacyActionError(null); setConfirmation('unblock'); } }
      : { destructive: true, icon: 'ban-outline', label: 'Kullanıcıyı engelle', onPress: () => { setPrivacyActionError(null); setConfirmation('block'); } },
    { destructive: true, icon: 'trash-outline', label: 'Sohbeti sil', onPress: () => { setPrivacyActionError(null); setConfirmation('deleteConversation'); } },
  ];
  const confirmCopy = confirmation === 'block'
    ? { title: 'Kullanıcıyı engelle?', description: 'Bu kullanıcıyla özel mesajlaşman durdurulacak.\nMevcut sohbet geçmişin korunacak.', label: 'Engelle', destructive: true }
    : confirmation === 'unblock'
      ? { title: 'Engeli kaldır?', description: 'Aynı sohbet ve mevcut mesaj geçmişi korunarak özel mesajlaşma yeniden açılacak.', label: 'Engeli kaldır', destructive: false }
      : { title: 'Sohbeti sil?', description: 'Bu sohbet Sohbetler ekranından yalnızca senin için kaldırılacak.', label: 'Sohbeti sil', destructive: true };
  return <SafeAreaView edges={['top']} style={{ backgroundColor: colors.chatBackground, flex: 1 }}>
    <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 58, paddingHorizontal: spacing.sm }}>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chats')} style={{ alignItems: 'center', height: 48, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textPrimary} name="arrow-back" size={25} /></Pressable>
      <Avatar accessibilityLabel={`${title} profil fotoğrafı`} imageURL={photoURL} initials={title.charAt(0)} size={42} />
      <View style={{ flex: 1 }}><AppText weight="900">{title}</AppText><AppText color="muted" variant="caption">Özel mesaj</AppText></View>
      <Pressable accessibilityLabel="Kullanıcı işlemlerini aç" accessibilityRole="button" onPress={() => setUserMenuOpen(true)} style={{ alignItems: 'center', height: 48, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textPrimary} name="ellipsis-vertical" size={22} /></Pressable>
    </View>
    {error ? <View style={{ backgroundColor: colors.surfaceSecondary, padding: spacing.sm }}><AppText color="danger" variant="caption">{error}</AppText></View> : null}
    <View style={{ flex: 1, overflow: 'hidden' }}>
    <Reanimated.View style={[{ flex: 1 }, layoutStyle]}>
      <FlatList ref={listRef} automaticallyAdjustContentInsets={false} automaticallyAdjustKeyboardInsets={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md }} contentInsetAdjustmentBehavior="never" data={visibleMessages} inverted keyboardDismissMode="none" keyboardShouldPersistTaps="always" keyExtractor={(item) => item.id} ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} /> : null} onEndReached={() => void loadOlder()} onEndReachedThreshold={0.25} onScrollToIndexFailed={({ index }) => listRef.current?.scrollToOffset({ animated: true, offset: index * 72 })} removeClippedSubviews={false}
        renderItem={({ item, index }) => <DirectMessageRow conversationId={conversationId} highlighted={highlightedId === item.id} message={item} onError={setError} onLongPress={setSelected} onOpenImage={setViewer} onOpenReply={openReply} onReply={reply} onRetry={retryMessage} own={item.senderUid === session?.userId} read={Boolean(item.createdAt && otherReadAt && otherReadAt >= item.createdAt)} reply={item.replyToMessageId ? byId.get(item.replyToMessageId) ?? null : null} showDate={shouldShowDateSeparator(visibleMessages[index + 1], item)} />} />
      {!messagingAllowed || blocked ? <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, gap: spacing.xs, padding: spacing.md }}>
        <AppText weight="900">{blocked ? 'Bu kullanıcıyı engelledin.' : 'Mesajlaşma kullanılamıyor.'}</AppText>
        <AppText color="muted" variant="caption">{blocked ? 'Bu kullanıcıyla özel mesajlaşma durduruldu.' : 'Bu kullanıcıya şu anda mesaj gönderilemiyor.'}</AppText>
        {blocked ? <Pressable accessibilityRole="button" onPress={() => { setPrivacyActionError(null); setConfirmation('unblock'); }} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg }}><AppText weight="900" style={{ color: colors.primary }}>Engeli kaldır</AppText></Pressable> : null}
      </View> : <ChatComposer disabled={false} focusRequest={focusRequest} nativeID="devrem-direct-chat-input" onAttachment={() => { void KeyboardController.dismiss(); setAttachmentOpen(true); }} onSend={sendText} onStopReply={() => setReplyingTo(null)} replyPreview={replyingTo ? getDevreChatMessagePreview(replyingTo as DevreChatMessage) : null} replySender={replyingTo ? (replyingTo.senderUid === session?.userId ? 'Sen' : title) : null} />}
    </Reanimated.View>
    </View>
    <ChatBottomSheet actions={attachmentActions} onClose={() => setAttachmentOpen(false)} title="Ekle" visible={attachmentOpen} />
    <ChatBottomSheet actions={actions} onClose={() => setSelected(null)} visible={Boolean(selected)} />
    <ChatBottomSheet actions={userActions} onClose={() => setUserMenuOpen(false)} title="Kullanıcı İşlemleri" visible={userMenuOpen} />
    <ChatCameraModal onClose={() => setCameraOpen(false)} onPhoto={(photo) => { setCameraOpen(false); setPreview(photo); }} visible={cameraOpen} />
    <DevremReportSheet
      onBlockRequested={() => { setReportTargetMessageId(undefined); setPrivacyActionError(null); setConfirmation('block'); }}
      onClose={() => setReportTargetMessageId(undefined)}
      onSubmit={submitReport}
      title={reportTargetMessageId ? 'Mesajı bildir' : 'Kullanıcıyı bildir'}
      visible={reportTargetMessageId !== undefined}
    />
    <DevremConfirmModal
      confirmLabel={confirmCopy.label}
      description={confirmCopy.description}
      destructive={confirmCopy.destructive}
      error={privacyActionError}
      loading={privacyActionLoading}
      onClose={() => { if (!privacyActionLoading) { setConfirmation(null); setPrivacyActionError(null); } }}
      onConfirm={() => void runPrivacyAction()}
      title={confirmCopy.title}
      visible={confirmation !== null}
    />
    <DevremConfirmModal
      confirmLabel={messageDeletion?.scope === 'everyone' ? 'Herkesten sil' : 'Benden sil'}
      description={messageDeletion?.scope === 'everyone'
        ? 'Bu mesaj sohbetteki herkes için silinecek. Bu işlem geri alınamaz.'
        : 'Bu mesaj yalnızca senin sohbet görünümünden kaldırılacak.'}
      destructive
      error={messageDeletionError}
      loading={messageDeletionLoading}
      onClose={() => { if (!messageDeletionLoading) { setMessageDeletion(null); setMessageDeletionError(null); } }}
      onConfirm={() => void runMessageDeletion()}
      title={messageDeletion?.scope === 'everyone' ? 'Mesaj herkesten silinsin mi?' : 'Mesaj senden silinsin mi?'}
      visible={messageDeletion !== null}
    />
    <PhotoPreview caption={caption} image={preview} onCaption={setCaption} onClose={() => { setPreview(null); setCaption(''); }} onSend={() => void sendImage()} sending={sendingImage} />
    {viewer ? <ChatImageViewer image={viewer} onClose={() => setViewer(null)} /> : null}
  </SafeAreaView>;
}
