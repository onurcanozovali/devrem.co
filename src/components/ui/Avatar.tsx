import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface AvatarProps {
  accessibilityLabel: string;
  imageURL?: string | null;
  initials: string;
  loading?: boolean;
  size?: number;
}

export function Avatar({
  accessibilityLabel,
  imageURL = null,
  initials,
  loading = false,
  size = 104,
}: AvatarProps) {
  const { colors } = useTheme();
  const [failedImageURL, setFailedImageURL] = useState<string | null>(null);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{
        alignItems: 'center',
        backgroundColor: colors.primarySubtle,
        borderColor: colors.border,
        borderRadius: size / 2,
        borderWidth: 1,
        height: size,
        justifyContent: 'center',
        overflow: 'hidden',
        width: size,
      }}
    >
      {imageURL && imageURL !== failedImageURL ? (
        <Image
          onError={() => setFailedImageURL(imageURL)}
          source={{ uri: imageURL }}
          style={{ height: size, width: size }}
        />
      ) : (
        <AppText
          weight="800"
          style={{ color: colors.primary, fontSize: Math.round(size * 0.32), lineHeight: Math.round(size * 0.4) }}
        >
          {initials}
        </AppText>
      )}
      {loading ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.overlay,
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          <ActivityIndicator color={colors.overlayContent} />
        </View>
      ) : null}
    </View>
  );
}