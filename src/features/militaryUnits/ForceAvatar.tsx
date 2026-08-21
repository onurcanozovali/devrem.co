import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { getForceBranding } from './forceBranding';
import type { ForceCode } from './types';

export function ForceAvatar({ forceCode, label = 'Devre grubu', size = 56 }: {
  forceCode: ForceCode | null | undefined;
  label?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const brand = getForceBranding(forceCode);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logoUrl = brand?.logoUrl && brand.logoUrl !== failedUrl ? brand.logoUrl : null;
  return <View accessible accessibilityLabel={`${label}: ${brand?.displayName ?? 'genel birlik'}`} accessibilityRole="image" style={{ alignItems: 'center', backgroundColor: logoUrl ? 'transparent' : brand?.accentColor ?? colors.primarySubtle, borderColor: colors.border, borderRadius: logoUrl ? 0 : Math.min(12, Math.round(size * 0.2)), borderWidth: logoUrl ? 0 : 1, height: size, justifyContent: 'center', overflow: 'hidden', width: size }}>
    {logoUrl ? <Image onError={() => setFailedUrl(logoUrl)} resizeMode="contain" source={{ uri: logoUrl }} style={{ height: size, width: size }} /> : <Ionicons color={colors.textInverse} name="shield-outline" size={Math.round(size * 0.48)} />}
  </View>;
}
