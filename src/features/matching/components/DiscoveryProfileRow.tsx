import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { getMilitaryPeriodLabel } from '@/features/profile/profileOptions';
import { useTheme } from '@/theme/ThemeProvider';
import type { PublicProfile } from '../types/discovery';

interface DiscoveryProfileRowProps {
  profile: PublicProfile;
  onPress: (userId: string) => void;
}

export const DiscoveryProfileRow = memo(function DiscoveryProfileRow({ profile, onPress }: DiscoveryProfileRowProps) {
  const { colors, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(profile.userId, profile.photoPath, profile.updatedAt);
  const destination = getProvinceName(profile.militaryCity);
  const period = getMilitaryPeriodLabel(profile.militaryPeriodYear, profile.militaryPeriodMonth);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.firstName}, ${destination}, ${period}. Profili aç`}
      onPress={() => onPress(profile.userId)}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceSubtle : colors.background,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 92,
        paddingVertical: spacing.md,
      })}
    >
      <Avatar
        accessibilityLabel={profile.photoPath ? `${profile.firstName} profil fotoğrafı` : `${profile.firstName} baş harfi`}
        imageURL={photoURL}
        initials={profile.firstName.charAt(0).toLocaleUpperCase('tr-TR')}
        size={64}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="subtitle" weight="800" numberOfLines={1}>{profile.firstName}</AppText>
        <AppText weight="600" numberOfLines={1}>{destination} · {period}</AppText>
        <AppText color="muted" variant="caption" numberOfLines={1}>
          {profile.militaryUnit ?? `${getProvinceName(profile.departureCity)} şehrinden yola çıkıyor`}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
});