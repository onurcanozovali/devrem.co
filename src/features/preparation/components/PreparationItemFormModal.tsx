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
import { PREPARATION_CATEGORIES } from '../preparationCategories';
import { validatePreparationTitle } from '../services/preparationDomain';
import type { PreparationCategoryId, PreparationItem, PreparationItemInput } from '../types/preparation';

export type PreparationFormMode = 'create' | 'edit' | 'category';

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
  const { colors, radii, spacing } = useTheme();
  const titleInputRef = useRef<TextInput>(null);
  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState<PreparationCategoryId>(item?.category ?? 'official');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || mode === 'category') return undefined;
    const timer = setTimeout(() => titleInputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [mode, visible]);

  const heading = mode === 'create' ? 'Görev ekle' : mode === 'category' ? 'Kategori değiştir' : 'Görevi düzenle';
  const submitLabel = mode === 'create' ? 'Görevi ekle' : 'Değişiklikleri kaydet';

  const submit = async () => {
    const validationError = validatePreparationTitle(title);
    setTitleError(validationError);
    setSubmitError(null);
    if (validationError) return;

    setSaving(true);
    try {
      await onSubmit({ title, category });
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

            <View style={{ gap: spacing.sm }}>
              <AppText weight="600">Kategori</AppText>
              <View
                accessibilityRole="radiogroup"
                style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' }}
              >
                {PREPARATION_CATEGORIES.map((option, index) => {
                  const selected = category === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: saving }}
                      disabled={saving}
                      onPress={() => setCategory(option.id)}
                      style={({ pressed }) => ({
                        alignItems: 'center',
                        backgroundColor: selected ? colors.primarySubtle : pressed ? colors.surfaceSecondary : colors.inputBackground,
                        borderTopColor: colors.divider,
                        borderTopWidth: index === 0 ? 0 : 1,
                        flexDirection: 'row',
                        gap: spacing.md,
                        minHeight: 52,
                        paddingHorizontal: spacing.md,
                      })}
                    >
                      <View style={{
                        alignItems: 'center',
                        borderColor: selected ? colors.primary : colors.border,
                        borderRadius: 10,
                        borderWidth: 2,
                        height: 20,
                        justifyContent: 'center',
                        width: 20,
                      }}>
                        {selected ? <View style={{ backgroundColor: colors.primary, borderRadius: 5, height: 10, width: 10 }} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText weight={selected ? '700' : '500'}>{option.label}</AppText>
                        <AppText color="muted" variant="caption">{option.shortDescription}</AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

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
