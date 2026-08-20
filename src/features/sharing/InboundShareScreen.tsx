import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { clearSharedPayloads, useIncomingShare } from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DEVRE_CHAT_MESSAGE_MAX_LENGTH } from '@/features/groups/chatDomain';
import { prepareChatImage, type SelectedChatImage } from '@/features/groups/chatMedia';
import { uploadAndSendDevreChatMediaMessage } from '@/features/groups/services/sendChatMedia';
import { useCurrentDevreGroup } from '@/features/groups/useCurrentDevreGroup';
import {
  createDevreChatMessageId,
  createDocumentMessageDraft,
  createImageMessageDraft,
} from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { deleteInboundShareFile, resolvePendingInboundShare } from './inboundShareFile';
import { inboundShareErrorMessage, type PendingInboundShare } from './inboundShareDomain';
import {
  beginInboundShareSend,
  bindInboundShareToUser,
  clearInboundShareSession,
  releaseInboundShareSend,
} from './inboundShareSession';

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function leaveShareFlow(): void {
  if (router.canGoBack()) router.back();
  else BackHandler.exitApp();
}

export function InboundShareScreen() {
  const { colors, radii, spacing } = useTheme();
  const { status, session } = useAuth();
  const { profile, result, error: groupError, retry } = useCurrentDevreGroup();
  const incoming = useIncomingShare();
  const [pending, setPending] = useState<PendingInboundShare | null>(null);
  const [image, setImage] = useState<SelectedChatImage | null>(null);
  const [caption, setCaption] = useState('');
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const resolvingKeyRef = useRef<string | null>(null);
  const payloadKey = useMemo(() => incoming.sharedPayloads.map((item) => `${item.value}|${item.mimeType}|${item.shareType}`).join('\n'), [incoming.sharedPayloads]);

  useEffect(() => {
    if (!payloadKey || incoming.isResolving || !incoming.resolvedSharedPayloads.length || resolvingKeyRef.current === payloadKey) return;
    resolvingKeyRef.current = payloadKey;
    void resolvePendingInboundShare(incoming.resolvedSharedPayloads).then((resolved) => {
      setPending(resolved.share);
      setImage(resolved.image);
      setFatalError(null);
    }).catch((caught: unknown) => setFatalError(inboundShareErrorMessage(caught)));
  }, [incoming.isResolving, incoming.resolvedSharedPayloads, payloadKey]);

  useEffect(() => {
    if (!pending || !session) return;
    if (bindInboundShareToUser(pending.fingerprint, session.userId)) return;
    deleteInboundShareFile(pending);
    clearSharedPayloads();
    queueMicrotask(() => {
      setPending(null);
      setImage(null);
      setFatalError('Bu paylaşım başka bir hesaba ait olduğu için iptal edildi.');
    });
  }, [pending, session]);

  const cancel = useCallback(() => {
    deleteInboundShareFile(pending);
    clearInboundShareSession(pending?.fingerprint);
    clearSharedPayloads();
    leaveShareFlow();
  }, [pending]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { cancel(); return true; });
    return () => subscription.remove();
  }, [cancel]);

  const send = async () => {
    if (!pending || !session || result?.status !== 'ready' || sending) return;
    if (!bindInboundShareToUser(pending.fingerprint, session.userId)) {
      setFatalError('Hesap değiştiği için paylaşım gönderilemedi.');
      return;
    }
    if (!beginInboundShareSend(pending.fingerprint)) return;
    setSending(true);
    setSendError(null);
    let preparedUri: string | null = null;
    try {
      const groupId = result.group.groupId;
      const messageId = createDevreChatMessageId(groupId);
      if (pending.attachment.kind === 'image') {
        if (!image) throw new Error('invalid-file-signature');
        const prepared = await prepareChatImage(image);
        preparedUri = prepared.uri;
        await uploadAndSendDevreChatMediaMessage(groupId, createImageMessageDraft({
          caption,
          groupId,
          height: prepared.height,
          localMediaUri: prepared.uri,
          messageId,
          senderUid: session.userId,
          width: prepared.width,
        }));
      } else {
        await uploadAndSendDevreChatMediaMessage(groupId, createDocumentMessageDraft({
          ...pending.attachment,
          groupId,
          localMediaUri: pending.attachment.uri,
          messageId,
          senderUid: session.userId,
        }));
      }
      deleteInboundShareFile(pending);
      clearInboundShareSession(pending.fingerprint);
      clearSharedPayloads();
      router.replace({ pathname: '/group-chat/[groupId]', params: { groupId, source: 'inboundShare' } });
    } catch {
      releaseInboundShareSend(pending.fingerprint);
      setSendError('Dosya gönderilemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      if (preparedUri && preparedUri !== pending.attachment.uri) {
        try { const file = new File(preparedUri); if (file.exists) file.delete(); } catch { /* best effort */ }
      }
      setSending(false);
    }
  };

  if (incoming.isResolving || (payloadKey && !pending && !fatalError)) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Paylaşım hazırlanıyor…" /></ScreenContainer>;
  }
  if (incoming.error || fatalError) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Dosya açılamadı" description={fatalError ?? 'Paylaşılan dosya okunamadı.'} actionLabel="Kapat" onAction={cancel} /></ScreenContainer>;
  }
  if (!payloadKey || !pending) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Paylaşım bulunamadı" description="Dosyayı yeniden paylaşmayı dene." actionLabel="Kapat" onAction={cancel} /></ScreenContainer>;
  }
  if (status !== 'authenticated' || !session) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Giriş yapman gerekiyor" description="Dosya güvenle bekletiliyor. Devre grubuna göndermek için telefon numaranla giriş yap." actionLabel="Giriş Yap" onAction={() => router.push('/phone')} /></ScreenContainer>;
  }
  if (!profile?.onboardingCompleted) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Profilini tamamla" description="Devre grubunu bulabilmemiz için askerlik bilgilerini tamamlamalısın." actionLabel="Profili Tamamla" onAction={() => router.push('/onboarding')} /></ScreenContainer>;
  }
  if (groupError) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Devre grubun yüklenemedi" description={groupError} actionLabel="Tekrar Dene" onAction={retry} /></ScreenContainer>;
  }
  if (!result) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Devre grubun yükleniyor…" /></ScreenContainer>;
  }
  if (result.status !== 'ready') {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Henüz aktif bir Devre grubun bulunmuyor" description="Grubun hazır olduğunda bu dosyayı tekrar paylaşabilirsin." actionLabel="Kapat" onAction={cancel} /></ScreenContainer>;
  }

  const attachment = pending.attachment;
  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Pressable accessibilityLabel="Paylaşımı iptal et" onPress={cancel} style={{ padding: spacing.sm }}><Ionicons color={colors.textPrimary} name="close" size={28} /></Pressable>
        <View style={{ flex: 1 }}><AppText variant="subtitle" weight="900">Devre Grubuna Gönder</AppText><AppText color="muted" variant="caption">Göndermeden önce dosyayı kontrol et.</AppText></View>
      </View>
      <Card style={{ gap: spacing.md }}>
        {attachment.kind === 'image' && image ? (
          <Image resizeMode="contain" source={{ uri: image.uri }} style={{ aspectRatio: image.width / image.height, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, maxHeight: 420, width: '100%' }} />
        ) : (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
            <View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: radii.md, height: 60, justifyContent: 'center', width: 60 }}><Ionicons color={colors.primary} name="document-text" size={30} /></View>
            <View style={{ flex: 1 }}><AppText numberOfLines={2} weight="900">{attachment.fileName}</AppText><AppText color="muted" variant="caption">{formatSize(attachment.sizeBytes)} · {attachment.kind === 'document' ? attachment.extension.toUpperCase() : attachment.mimeType}</AppText></View>
          </View>
        )}
        {attachment.kind === 'image' ? <TextInput maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH} multiline onChangeText={setCaption} placeholder="Bir açıklama ekle..." placeholderTextColor={colors.placeholder} style={{ backgroundColor: colors.inputBackground, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.textPrimary, minHeight: 52, padding: spacing.md }} value={caption} /> : null}
      </Card>
      {sendError ? <AppText color="danger" accessibilityLiveRegion="polite">{sendError}</AppText> : null}
      <Button label="Devre Grubuna Gönder" loading={sending} onPress={() => void send()} />
      <Button label="Vazgeç" disabled={sending} onPress={cancel} variant="secondary" />
    </ScreenContainer>
  );
}
