import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { DEVRE_CHAT_MESSAGE_MAX_LENGTH, validateDevreChatText } from './chatDomain';

interface ChatComposerProps {
  disabled: boolean;
  focusRequest: number;
  nativeID?: string;
  onAttachment: () => void;
  onSend: (text: string) => void;
  onStopReply: () => void;
  replyPreview: string | null;
  replySender: string | null;
}

export const ChatComposer = memo(function ChatComposer({ disabled, focusRequest, nativeID, onAttachment, onSend, onStopReply, replyPreview, replySender }: ChatComposerProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  useEffect(() => {
    if (!focusRequest) return;
    inputRef.current?.focus();
  }, [focusRequest]);

  const submit = () => {
    if (disabled || validateDevreChatText(text)) return;
    onSend(text);
    setText('');
  };

  return <View>
    {replyPreview ? <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      <View style={{ backgroundColor: colors.primary, borderRadius: 2, height: 42, marginRight: spacing.sm, width: 4 }} />
      <View style={{ flex: 1 }}><AppText style={{ color: colors.primary }} variant="caption" weight="900">{replySender ?? 'Devre'}</AppText><AppText color="muted" numberOfLines={1} variant="caption">{replyPreview}</AppText></View>
      <Pressable accessibilityLabel="Yanıtı iptal et" onPress={onStopReply} style={{ alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textMuted} name="close" size={22} /></Pressable>
    </View> : null}
    <View style={{ alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingBottom: keyboardVisible ? spacing.sm : Math.max(spacing.sm, insets.bottom), paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
      <View style={{ alignItems: 'flex-end', backgroundColor: colors.inputBackground, borderColor: colors.border, borderRadius: 23, borderWidth: 1, flex: 1, flexDirection: 'row', minHeight: 46 }}>
        <TextInput ref={inputRef} nativeID={nativeID} accessibilityLabel="Mesaj" editable={!disabled} maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH} multiline onChangeText={setText} placeholder="Mesaj yaz…" placeholderTextColor={colors.placeholder} scrollEnabled style={{ color: colors.textPrimary, flex: 1, fontSize: 16, maxHeight: 112, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }} value={text} />
        <Pressable accessibilityLabel="Dosya ekle" disabled={disabled} onPress={onAttachment} style={{ alignItems: 'center', height: 46, justifyContent: 'center', opacity: disabled ? 0.45 : 1, width: 44 }}><Ionicons color={colors.textMuted} name="attach" size={26} /></Pressable>
      </View>
      <Pressable accessibilityLabel="Mesajı gönder" disabled={disabled || !hasText} onPress={submit} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 23, height: 46, justifyContent: 'center', opacity: disabled || !hasText ? 0.42 : 1, width: 46 }}><Ionicons color={colors.textInverse} name="send" size={22} /></Pressable>
    </View>
  </View>;
});
