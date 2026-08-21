import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export function MainTabHeader({ action, subtitle, title }: {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  const { spacing } = useTheme();
  return <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm }}>
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="title" weight="800">{title}</AppText>
      {subtitle ? <AppText color="muted" variant="caption">{subtitle}</AppText> : null}
    </View>
    {action}
  </View>;
}
