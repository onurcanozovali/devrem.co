import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { themeModeLabels, themeModes, type ThemeMode } from '@/theme/themeMode';

interface ThemeSelectionModalProps {
  onClose: () => void;
  onSelect: (mode: ThemeMode) => void;
  selectedMode: ThemeMode;
  visible: boolean;
}

export function ThemeSelectionModal({
  onClose,
  onSelect,
  selectedMode,
  visible,
}: ThemeSelectionModalProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView
        accessibilityViewIsModal
        style={{ backgroundColor: colors.background, flex: 1 }}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={{ gap: spacing.lg, padding: spacing.lg }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
            <AppText variant="subtitle" weight="800">Görünüm</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Görünüm seçimini kapat"
              hitSlop={12}
              onPress={onClose}
            >
              <AppText weight="700" style={{ color: colors.primary }}>Kapat</AppText>
            </Pressable>
          </View>

          <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' }}>
            {themeModes.map((themeMode, index) => {
              const selected = themeMode === selectedMode;
              return (
                <View key={themeMode}>
                  {index > 0 ? <View style={{ backgroundColor: colors.divider, height: 1 }} /> : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, selected }}
                    onPress={() => onSelect(themeMode)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      backgroundColor: selected ? colors.primarySubtle : pressed ? colors.surfaceSecondary : colors.surfaceElevated,
                      flexDirection: 'row',
                      gap: spacing.md,
                      minHeight: 58,
                      paddingHorizontal: spacing.md,
                    })}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      color={selected ? colors.primary : colors.textMuted}
                      size={22}
                    />
                    <AppText style={{ flex: 1 }} weight={selected ? '700' : '500'}>
                      {themeModeLabels[themeMode]}
                    </AppText>
                    {selected ? <Ionicons name="checkmark" color={colors.primary} size={20} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>

        </View>
      </SafeAreaView>
    </Modal>
  );
}