import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Keyboard, Linking, Pressable, TextInput, useWindowDimensions, View,
  type NativeSyntheticEvent, type TextInputSelectionChangeEventData,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
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

const EmojiPanel = memo(function EmojiPanel({ onSelect, recent }: { onSelect: (emoji: string) => void; recent: readonly string[] }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const columns = width < 370 ? 6 : width > 520 ? 8 : 7;
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category = categoryIndex === 0 ? ['Son', ...recent] : EMOJI_CATEGORIES[categoryIndex] ?? EMOJI_CATEGORIES[0];
  return <View style={{ backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, height: 310, paddingHorizontal: spacing.sm }}>
    <FlatList contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.sm }} data={EMOJI_CATEGORIES} horizontal keyExtractor={(item) => item[0]} renderItem={({ item, index }) => <Pressable onPress={() => setCategoryIndex(index)} style={{ backgroundColor: index === categoryIndex ? colors.primarySubtle : 'transparent', borderRadius: 999, minHeight: 38, paddingHorizontal: spacing.md, justifyContent: 'center' }}><AppText color={index === categoryIndex ? undefined : 'muted'} variant="caption" weight="800">{item[0]}</AppText></Pressable>} showsHorizontalScrollIndicator={false} />
    <FlatList data={category.slice(1)} key={`${category[0]}-${columns}`} keyboardShouldPersistTaps="always" keyExtractor={(emoji) => emoji} numColumns={columns} renderItem={({ item: emoji }) => <Pressable accessibilityLabel={`${emoji} emojisini ekle`} onPress={() => onSelect(emoji)} style={{ alignItems: 'center', height: 52, justifyContent: 'center', width: `${100 / columns}%` }}><AppText style={{ fontSize: 32, lineHeight: 39 }}>{emoji}</AppText></Pressable>} />
  </View>;
});

export const ChatComposer = memo(function ChatComposer({ disabled, onAttachment, onAudio, onSend }: {
  disabled: boolean;
  onAttachment: () => void;
  onAudio: (uri: string, durationMillis: number) => void;
  onSend: (text: string) => void;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const holdingRef = useRef(false);
  const finishingRef = useRef(false);
  const durationRef = useRef(0);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(['😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '🫡']);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const hasText = text.trim().length > 0;
  useEffect(() => { durationRef.current = recorderState.durationMillis; }, [recorderState.durationMillis]);
  useEffect(() => () => { if (limitTimerRef.current) clearTimeout(limitTimerRef.current); }, []);
  const finishRecording = useCallback(async (send: boolean) => {
    if (!recorder.isRecording || finishingRef.current) return;
    finishingRef.current = true;
    if (limitTimerRef.current) { clearTimeout(limitTimerRef.current); limitTimerRef.current = null; }
    const duration = Math.min(180000, Math.max(1, durationRef.current));
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (send && recorder.uri) onAudio(recorder.uri, duration);
    } finally { finishingRef.current = false; }
  }, [onAudio, recorder]);
  const beginRecording = useCallback(async () => {
    holdingRef.current = true;
    try {
      const current = await getRecordingPermissionsAsync();
      const permission = current.granted ? current : await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        holdingRef.current = false;
        Alert.alert('Mikrofon izni gerekli', 'Sesli mesaj kaydetmek için mikrofon iznini açmalısın.', [
          { text: 'Vazgeç', style: 'cancel' }, { text: 'Ayarları Aç', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      if (!holdingRef.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      durationRef.current = 0;
      recorder.record();
      limitTimerRef.current = setTimeout(() => { holdingRef.current = false; void finishRecording(true); }, 180000);
    } catch {
      holdingRef.current = false;
      Alert.alert('Mikrofon kullanılamadı', 'Bu özellik için yeni development build kurulu olmalı. Build güncelse sistem ayarlarını kontrol et.');
    }
  }, [finishRecording, recorder]);
  const insertEmoji = (emoji: string) => {
    setText((current) => `${current.slice(0, selection.start)}${emoji}${current.slice(selection.end)}`);
    const next = selection.start + emoji.length;
    setSelection({ start: next, end: next });
    setRecentEmojis((current) => [emoji, ...current.filter((item) => item !== emoji)].slice(0, 16));
  };
  const submit = () => {
    if (disabled || validateDevreChatText(text)) return;
    onSend(text); setText(''); setSelection({ start: 0, end: 0 });
  };
  return <KeyboardStickyView enabled={!emojiOpen}>
    {recorderState.isRecording ? <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingBottom: Math.max(spacing.sm, insets.bottom), paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      <View style={{ backgroundColor: colors.danger, borderRadius: 999, height: 10, width: 10 }} />
      <AppText weight="900">{Math.floor(recorderState.durationMillis / 60000)}:{String(Math.floor(recorderState.durationMillis / 1000) % 60).padStart(2, '0')}</AppText>
      <AppText color="muted" style={{ flex: 1 }}>Bırakınca gönderilir</AppText>
      <Pressable accessibilityLabel="Kaydı iptal et" onPress={() => void finishRecording(false)} style={{ minHeight: 44, justifyContent: 'center' }}><AppText color="danger" weight="900">İptal</AppText></Pressable>
    </View> : <View style={{ alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingBottom: emojiOpen ? spacing.sm : Math.max(spacing.sm, insets.bottom), paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
      <Pressable accessibilityLabel={emojiOpen ? 'Klavyeyi aç' : 'Emoji panelini aç'} onPress={() => { if (emojiOpen) { setEmojiOpen(false); setTimeout(() => inputRef.current?.focus(), 50); } else { Keyboard.dismiss(); setEmojiOpen(true); } }} style={{ alignItems: 'center', height: 46, justifyContent: 'center', width: 42 }}><Ionicons color={colors.textMuted} name={emojiOpen ? 'keypad-outline' : 'happy-outline'} size={27} /></Pressable>
      <View style={{ alignItems: 'flex-end', backgroundColor: colors.inputBackground, borderColor: colors.border, borderRadius: 23, borderWidth: 1, flex: 1, flexDirection: 'row', minHeight: 46 }}>
        <TextInput ref={inputRef} accessibilityLabel="Mesaj" editable={!disabled} maxLength={DEVRE_CHAT_MESSAGE_MAX_LENGTH} multiline onChangeText={setText} onFocus={() => setEmojiOpen(false)} onSelectionChange={(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => setSelection(event.nativeEvent.selection)} placeholder="Mesaj yaz…" placeholderTextColor={colors.placeholder} selection={selection} style={{ color: colors.textPrimary, flex: 1, fontSize: 16, maxHeight: 112, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }} value={text} />
        <Pressable accessibilityLabel="Dosya ekle" onPress={onAttachment} style={{ alignItems: 'center', height: 46, justifyContent: 'center', width: 44 }}><Ionicons color={colors.textMuted} name="attach" size={26} /></Pressable>
      </View>
      <Pressable accessibilityLabel={hasText ? 'Mesajı gönder' : 'Sesli mesaj kaydet'} disabled={disabled} onPress={hasText ? submit : undefined} onPressIn={hasText ? undefined : () => void beginRecording()} onPressOut={hasText ? undefined : () => { holdingRef.current = false; void finishRecording(true); }} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 23, height: 46, justifyContent: 'center', opacity: disabled ? 0.45 : 1, width: 46 }}><Ionicons color={colors.textInverse} name={hasText ? 'send' : 'mic'} size={23} /></Pressable>
    </View>}
    {emojiOpen && !recorderState.isRecording ? <EmojiPanel onSelect={insertEmoji} recent={recentEmojis} /> : null}
  </KeyboardStickyView>;
});
