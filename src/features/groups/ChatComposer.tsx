import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useRef, useState } from 'react';
import {
  BackHandler, FlatList, Keyboard, Pressable, TextInput, useWindowDimensions, View,
  type NativeSyntheticEvent, type TextInputSelectionChangeEventData,
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { DEVRE_CHAT_MESSAGE_MAX_LENGTH, validateDevreChatText } from './chatDomain';

const EMOJI_CATEGORIES = [
  ['Son', '😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '🫡'],
  ['Yüzler', '😀', '😃', '😄', '😁', '😂', '😊', '😍', '🥹', '😎', '🤔', '😭', '😡', '🤩', '🥳'],
  ['İnsanlar', '👋', '👍', '👎', '👏', '🙏', '💪', '🫡', '🤝', '🙌', '✌️', '🤟', '👨‍👩‍👧'],
  ['Hayvanlar', '🐶', '🐱', '🐻', '🦁', '🐯', '🐼', '🐦', '🦅', '🐢', '🐬', '🦋', '🐝'],
  ['Yemek', '🍎', '🍕', '🍔', '🥙', '🍰', '☕', '🥤', '🍉', '🥐', '🍗', '🍜', '🍓'],
  ['Aktivite', '⚽', '🏀', '🏃', '🏋️', '🎮', '🎯', '🏆', '🎵', '🎬', '🎨', '🚴', '🏊'],
  ['Seyahat', '🚗', '🚌', '✈️', '🚆', '🚀', '🏠', '🏕️', '🌍', '🗺️', '🌅', '⛵', '🏖️'],
  ['Nesneler', '📱', '⌚', '💡', '📷', '🎁', '🔑', '📌', '✉️', '🎒', '📎', '📚', '💻'],
  ['Simgeler', '❤️', '💚', '✅', '❌', '⚠️', '💯', '🔥', '✨', '⭐', '❗', '❓', '➕'],
  ['Bayraklar', '🇹🇷', '🏳️', '🏁', '🚩', '🇦🇿', '🇩🇪', '🇫🇷', '🇬🇧', '🇺🇸', '🇮🇹', '🇪🇸', '🇯🇵'],
] as const;

const EmojiPanel = memo(function EmojiPanel({ height, onSelect, recent }: { height: number; onSelect: (emoji: string) => void; recent: readonly string[] }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const columns = width < 370 ? 6 : width > 520 ? 8 : 7;
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category = categoryIndex === 0 ? ['Son', ...recent] : EMOJI_CATEGORIES[categoryIndex] ?? EMOJI_CATEGORIES[0];
  return <View style={{ backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, height, paddingHorizontal: spacing.sm }}>
    <FlatList
      contentContainerStyle={{ alignItems: 'center', gap: 4, paddingVertical: 4 }}
      data={EMOJI_CATEGORIES}
      horizontal
      keyExtractor={(item) => item[0]}
      renderItem={({ item, index }) => <Pressable onPress={() => setCategoryIndex(index)} style={{ backgroundColor: index === categoryIndex ? colors.primarySubtle : 'transparent', borderRadius: 999, height: 32, justifyContent: 'center', paddingHorizontal: spacing.sm }}><AppText color={index === categoryIndex ? undefined : 'muted'} variant="caption" weight="800">{item[0]}</AppText></Pressable>}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, height: 40 }}
    />
    <FlatList
      contentContainerStyle={{ paddingTop: 4 }}
      data={category.slice(1)}
      key={`${category[0]}-${columns}`}
      keyboardShouldPersistTaps="always"
      keyExtractor={(emoji, index) => `${emoji}-${index}`}
      numColumns={columns}
      renderItem={({ item: emoji }) => <Pressable accessibilityLabel={`${emoji} emojisini ekle`} onPress={() => onSelect(emoji)} style={{ alignItems: 'center', height: 50, justifyContent: 'center', width: `${100 / columns}%` }}><AppText style={{ fontSize: 32, lineHeight: 39 }}>{emoji}</AppText></Pressable>}
    />
  </View>;
});

export const ChatComposer = memo(function ChatComposer({ disabled, nativeID, onAttachment, onSend, onStopReply, replyPreview, replySender }: {
  disabled: boolean;
  nativeID?: string;
  onAttachment: () => void;
  onSend: (text: string) => void;
  onStopReply: () => void;
  replyPreview: string | null;
  replySender: string | null;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardHeight = useKeyboardState((state) => state.height);
  const inputRef = useRef<TextInput>(null);
  const lastKeyboardHeightRef = useRef(260);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiHeight, setEmojiHeight] = useState(260);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(['😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '🫡']);
  const hasText = text.trim().length > 0;
  useEffect(() => {
    if (keyboardHeight > 180) lastKeyboardHeightRef.current = keyboardHeight;
    if (keyboardVisible && emojiOpen) setEmojiOpen(false);
  }, [emojiOpen, keyboardHeight, keyboardVisible]);
  useEffect(() => {
    if (!replyPreview) return;
    setEmojiOpen(false);
    inputRef.current?.focus();
  }, [replyPreview]);
  useEffect(() => {
    if (!emojiOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setEmojiOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [emojiOpen]);
  const insertEmoji = (emoji: string) => {
    setText((current) => `${current.slice(0, selection.start)}${emoji}${current.slice(selection.end)}`);
    const next = selection.start + emoji.length;
    setSelection({ start: next, end: next });
    setRecentEmojis((current) => [emoji, ...current.filter((item) => item !== emoji)].slice(0, 16));
  };
  const submit = () => {
    if (disabled || validateDevreChatText(text)) return;
    onSend(text);
    setText('');
    setSelection({ start: 0, end: 0 });
  };
  const toggleEmoji = () => {
    if (emojiOpen) {
      inputRef.current?.focus();
      return;
    }
    setEmojiHeight(Math.max(240, lastKeyboardHeightRef.current));
    setEmojiOpen(true);
    Keyboard.dismiss();
  };
  const openAttachment = () => {
    setEmojiOpen(false);
    Keyboard.dismiss();
    onAttachment();
  };
  return <View>
    {replyPreview ? <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      <View style={{ backgroundColor: colors.primary, borderRadius: 2, height: 42, marginRight: spacing.sm, width: 4 }} />
      <View style={{ flex: 1 }}><AppText style={{ color: colors.primary }} variant="caption" weight="900">{replySender ?? 'Devre'}</AppText><AppText color="muted" numberOfLines={1} variant="caption">{replyPreview}</AppText></View>
      <Pressable accessibilityLabel="Yanıtı iptal et" onPress={onStopReply} style={{ alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textMuted} name="close" size={22} /></Pressable>
    </View> : null}
    <View style={{ alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingBottom: keyboardVisible || emojiOpen ? spacing.sm : Math.max(spacing.sm, insets.bottom), paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
      <Pressable accessibilityLabel={emojiOpen ? 'Klavyeyi aç' : 'Emoji panelini aç'} onPress={toggleEmoji} style={{ alignItems: 'center', height: 46, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textMuted} name={emojiOpen ? 'keypad-outline' : 'happy-outline'} size={27} /></Pressable>
      <View style={{ alignItems: 'flex-end', backgroundColor: colors.inputBackground, borderColor: colors.border, borderRadius: 23, borderWidth: 1, flex: 1, flexDirection: 'row', minHeight: 46 }}>
        <TextInput ref={inputRef} nativeID={nativeID} accessibilityLabel="Mesaj" editable={!disabled} maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH} multiline onChangeText={setText} onSelectionChange={(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => setSelection(event.nativeEvent.selection)} placeholder="Mesaj yaz…" placeholderTextColor={colors.placeholder} scrollEnabled selection={selection} style={{ color: colors.textPrimary, flex: 1, fontSize: 16, maxHeight: 112, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }} value={text} />
        <Pressable accessibilityLabel="Dosya ekle" disabled={disabled} onPress={openAttachment} style={{ alignItems: 'center', height: 46, justifyContent: 'center', opacity: disabled ? 0.45 : 1, width: 44 }}><Ionicons color={colors.textMuted} name="attach" size={26} /></Pressable>
      </View>
      <Pressable accessibilityLabel="Mesajı gönder" disabled={disabled || !hasText} onPress={submit} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 23, height: 46, justifyContent: 'center', opacity: disabled || !hasText ? 0.42 : 1, width: 46 }}><Ionicons color={colors.textInverse} name="send" size={22} /></Pressable>
    </View>
    {emojiOpen ? <EmojiPanel height={emojiHeight} onSelect={insertEmoji} recent={recentEmojis} /> : null}
  </View>;
});
