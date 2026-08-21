import { ActivityIndicator, Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

export function DevremConfirmModal({ confirmLabel, description, destructive = false, error, loading = false, onClose, onConfirm, title, visible }: {
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  error?: string | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const close = () => { if (!loading) onClose(); };
  return <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
    <Pressable accessibilityLabel="Pencereyi kapat" onPress={close} style={{ alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.lg }}>
      <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, gap: spacing.md, maxWidth: 420, padding: spacing.lg, width: '100%' }}>
        <View style={{ gap: spacing.sm }}><AppText variant="subtitle" weight="900">{title}</AppText><AppText color="muted">{description}</AppText></View>
        {error ? <AppText accessibilityLiveRegion="polite" color="danger" variant="caption">{error}</AppText> : null}
        <View style={{ gap: spacing.sm }}>
          <Pressable disabled={loading} onPress={onConfirm} style={({ pressed }) => ({ alignItems: 'center', backgroundColor: destructive ? colors.danger : pressed ? colors.primaryPressed : colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 50, opacity: loading ? 0.7 : 1 })}>{loading ? <ActivityIndicator color={colors.textInverse} /> : <AppText weight="800" style={{ color: colors.textInverse }}>{confirmLabel}</AppText>}</Pressable>
          <Pressable disabled={loading} onPress={close} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 46 }}><AppText weight="800" style={{ color: colors.primary }}>Vazgeç</AppText></Pressable>
        </View>
      </Pressable>
    </Pressable>
  </Modal>;
}
