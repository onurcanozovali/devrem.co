import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { PreparationItem } from '../types/preparation';

interface PreparationItemActionsModalProps {
  item: PreparationItem | null;
  onClose: () => void;
  onEdit: () => void;
  onChangeCategory: () => void;
  onDelete: () => void;
}

export function PreparationItemActionsModal({
  item,
  onClose,
  onEdit,
  onChangeCategory,
  onDelete,
}: PreparationItemActionsModalProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Modal visible={Boolean(item)} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Görev işlemlerini kapat"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={[styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg }]}
        >
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <View style={{ backgroundColor: colors.border, borderRadius: 2, height: 4, width: 42 }} />
            <AppText variant="subtitle" weight="800" numberOfLines={2} style={{ textAlign: 'center' }}>
              {item?.title}
            </AppText>
          </View>
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <Action label="Düzenle" onPress={onEdit} />
            <Action label="Kategori Değiştir" onPress={onChangeCategory} />
            <Action label="Sil" destructive onPress={onDelete} />
            <Action label="Vazgeç" muted onPress={onClose} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Action({
  label,
  onPress,
  destructive = false,
  muted = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  muted?: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
        borderRadius: radii.md,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: spacing.md,
      })}
    >
      <AppText color={destructive ? 'danger' : muted ? 'muted' : 'default'} weight={destructive ? '700' : '600'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(0, 0, 0, 0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%' },
});
