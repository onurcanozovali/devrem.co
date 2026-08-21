import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme/ThemeProvider';
import { validatePreparationTitle } from '../services/preparationDomain';
import type { PreparationItem, PreparationItemInput } from '../types/preparation';

export type PreparationFormMode = 'create' | 'edit';

interface PreparationItemFormModalProps {
  visible: boolean;
  mode: PreparationFormMode;
  item: PreparationItem | null;
  onClose: () => void;
  onSubmit: (input: PreparationItemInput) => Promise<void>;
}

export function PreparationItemFormModal({
  visible,
  mode,
  item,
  onClose,
  onSubmit,
}: PreparationItemFormModalProps) {
  const { colors, spacing } = useTheme();
  const titleInputRef = useRef<TextInput>(null);
  const [title, setTitle] = useState(item?.title ?? '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => titleInputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [mode, visible]);

  const heading = mode === 'create' ? 'Görev ekle' : 'Görevi düzenle';
  const submitLabel = mode === 'create' ? 'Görevi ekle' : 'Değişiklikleri kaydet';

  const submit = async () => {
    const validationError = validatePreparationTitle(title);
    setTitleError(validationError);
    setSubmitError(null);
    if (validationError) return;

    setSaving(true);
    try {
      // Custom tasks use a stable internal category; the UI groups every custom item
      // under “Benim Eklediklerim” independently of the default category taxonomy.
      await onSubmit({ title, category: item?.category ?? 'personal' });
      onClose();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Görev kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={saving ? undefined : onClose}>
      <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md }}>
            <AppText variant="subtitle" weight="800" style={{ flex: 1 }}>{heading}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Görev formunu kapat"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              hitSlop={12}
              onPress={onClose}
            >
              <AppText weight="700" style={{ color: colors.primary }}>Kapat</AppText>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.sm }}
          >
            <TextField
              ref={titleInputRef}
              label="Görev adı"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (titleError) setTitleError(null);
              }}
              error={titleError}
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              editable={!saving}
            />

            {submitError ? (
              <AppText color="danger" accessibilityLiveRegion="polite">{submitError}</AppText>
            ) : null}

            <Button label={submitLabel} loading={saving} onPress={() => void submit()} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
