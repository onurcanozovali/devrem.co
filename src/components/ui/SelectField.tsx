import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

type SelectValue = string | number;

export interface SelectOption<T extends SelectValue> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends SelectValue> {
  label: string;
  placeholder: string;
  value: T | null;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  error?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function SelectField<T extends SelectValue>({
  label,
  placeholder,
  value,
  options,
  onValueChange,
  error,
  searchable = options.length > 12,
  searchPlaceholder = 'Ara',
}: SelectFieldProps<T>) {
  const { colors, radii, spacing, typography } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedSearch) return options;
    return options.filter((option) => option.label.toLocaleLowerCase('tr-TR').includes(normalizedSearch));
  }, [options, search]);

  const close = () => {
    setIsOpen(false);
    setSearch('');
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText weight="600">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedOption?.label ?? 'seçilmedi'}`}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          minHeight: 54,
          paddingHorizontal: spacing.md,
        })}
      >
        <AppText color={selectedOption ? 'default' : 'muted'}>{selectedOption?.label ?? placeholder}</AppText>
        <AppText color="muted" variant="subtitle">⌄</AppText>
      </Pressable>
      {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}

      <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
          <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <AppText variant="subtitle" weight="800" style={{ flex: 1 }}>{label}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Seçim ekranını kapat" onPress={close} hitSlop={12}>
                <AppText weight="700" style={{ color: colors.primary }}>Kapat</AppText>
              </Pressable>
            </View>

            {searchable ? (
              <TextInput
                accessibilityLabel={`${label} seçeneklerinde ara`}
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  color: colors.text,
                  fontSize: typography.sizes.body,
                  minHeight: 50,
                  paddingHorizontal: spacing.md,
                }}
              />
            ) : null}

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
              ListEmptyComponent={<AppText color="muted" style={{ textAlign: 'center', padding: spacing.xl }}>Sonuç bulunamadı.</AppText>}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onValueChange(item.value);
                      close();
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: isSelected || pressed ? colors.surfaceSubtle : colors.background,
                      minHeight: 52,
                      justifyContent: 'center',
                      paddingHorizontal: spacing.md,
                    })}
                  >
                    <AppText weight={isSelected ? '700' : '400'} style={isSelected ? { color: colors.primary } : undefined}>
                      {item.label}
                    </AppText>
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
