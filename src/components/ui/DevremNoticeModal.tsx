import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

export function DevremNoticeModal({ buttonLabel = 'Tamam', description, onClose, title, visible }: {
  buttonLabel?: string;
  description: string;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <Pressable accessibilityLabel="Pencereyi kapat" onPress={onClose} style={{ alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.lg }}>
      <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, gap: spacing.lg, maxWidth: 420, padding: spacing.lg, width: '100%' }}>
        <View style={{ gap: spacing.sm }}><AppText variant="subtitle" weight="900">{title}</AppText><AppText color="muted">{description}</AppText></View>
        <Pressable onPress={onClose} style={({ pressed }) => ({ alignItems: 'center', backgroundColor: pressed ? colors.primaryPressed : colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 50 })}><AppText weight="800" style={{ color: colors.textInverse }}>{buttonLabel}</AppText></Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}
