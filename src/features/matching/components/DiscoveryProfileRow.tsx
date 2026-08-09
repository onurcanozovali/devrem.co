import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { useTheme } from '@/theme/ThemeProvider';
import { getMatchReasonBadges } from '../services/discoveryDomain';
import type { DiscoveryReferenceProfile, PublicProfile } from '../types/discovery';

interface DiscoveryProfileRowProps {
  profile: PublicProfile;
  reference: DiscoveryReferenceProfile;
  onPress: (userId: string) => void;
}

export const DiscoveryProfileRow = memo(function DiscoveryProfileRow({
  profile,
  reference,
  onPress,
}: DiscoveryProfileRowProps) {
  const { colors, radii, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(profile.userId, profile.photoPath, profile.updatedAt);
  const unit = profile.militaryUnit ?? 'Birliği henüz belli değil';
  const reasonBadges = getMatchReasonBadges(reference, profile);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.firstName}, ${unit}. ${reasonBadges.join(', ')}. Profili aç`}
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
        <AppText color="muted" variant="caption" numberOfLines={1}>{unit}</AppText>
        {reasonBadges.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs }}>
            {reasonBadges.map((reason) => (
              <View
                key={reason}
                style={{ backgroundColor: colors.surfaceSubtle, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }}
              >
                <AppText variant="caption" weight="700">{reason}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
});