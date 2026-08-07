import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { formatStoredDate, localDateToStoredDate, startOfLocalDay } from '@/features/profile/services/profileValidation';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  minimumDate: Date;
  onValueChange: (value: Date) => void;
  error?: string | null;
  hint?: string;
}

function clampToMinimum(value: Date | null, minimumDate: Date): Date {
  const normalizedMinimum = startOfLocalDay(minimumDate);
  if (!value) return normalizedMinimum;
  const normalizedValue = startOfLocalDay(value);
  return normalizedValue < normalizedMinimum ? normalizedMinimum : normalizedValue;
}

export function DatePickerField({
  label,
  value,
  minimumDate,
  onValueChange,
  error,
  hint,
}: DatePickerFieldProps) {
  const { colors, radii, spacing } = useTheme();
  const [showInlinePicker, setShowInlinePicker] = useState(false);
  const pickerValue = clampToMinimum(value, minimumDate);
  const displayValue = value ? formatStoredDate(localDateToStoredDate(value)) : 'Tarih seç';

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        minimumDate: startOfLocalDay(minimumDate),
        mode: 'date',
        display: 'calendar',
        onValueChange: (_event, selectedDate) => onValueChange(startOfLocalDay(selectedDate)),
      });
      return;
    }

    setShowInlinePicker(true);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText weight="600">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? displayValue : 'seçilmedi'}`}
        accessibilityHint="Takvimden tarih seçmek için dokunun"
        onPress={openPicker}
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
        <AppText color={value ? 'default' : 'muted'}>{displayValue}</AppText>
        <Ionicons name="calendar-outline" size={21} color={colors.primary} />
      </Pressable>

      {showInlinePicker && Platform.OS !== 'android' ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            borderWidth: 1,
            overflow: 'hidden',
            padding: spacing.sm,
          }}
        >
          <DateTimePicker
            value={pickerValue}
            minimumDate={startOfLocalDay(minimumDate)}
            mode="date"
            display="inline"
            onValueChange={(_event, selectedDate) => onValueChange(startOfLocalDay(selectedDate))}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onValueChange(pickerValue);
              setShowInlinePicker(false);
            }}
            style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
          >
            <AppText weight="700" style={{ color: colors.primary }}>Bitti</AppText>
          </Pressable>
        </View>
      ) : null}

      {hint ? <AppText color="muted" variant="caption">{hint}</AppText> : null}
      {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
    </View>
  );
}
