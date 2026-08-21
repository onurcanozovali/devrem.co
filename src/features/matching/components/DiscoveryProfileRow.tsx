import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { ForceAvatar } from '@/features/militaryUnits/ForceAvatar';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { useTheme } from '@/theme/ThemeProvider';
import { getMatchReasonBadges, getPublicProfileDisplayName } from '../services/discoveryDomain';
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
  const unit = profile.militaryUnitName ?? 'Birliği henüz belli değil';
  const reasonBadges = getMatchReasonBadges(reference, profile);
  const secondaryBadges = reasonBadges.filter((reason) => reason !== 'Aynı birlik');
  const displayName = getPublicProfileDisplayName(profile);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${unit}. ${reasonBadges.join(', ')}. Profili aç`}
      onPress={() => onPress(profile.userId)}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceSecondary : colors.background,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 78,
        paddingVertical: spacing.sm,
      })}
    >
      <Avatar
        accessibilityLabel={profile.photoPath ? `${displayName} profil fotoğrafı` : `${displayName} baş harfi`}
        imageURL={photoURL}
        initials={profile.firstName.charAt(0).toLocaleUpperCase('tr-TR')}
        size={52}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="subtitle" weight="800" numberOfLines={1}>{displayName}</AppText>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}><ForceAvatar forceCode={profile.forceCode} label="Kuvvet" size={20} /><AppText color="muted" style={{ flex: 1 }} variant="caption" numberOfLines={1}>{unit}</AppText></View>
        {secondaryBadges.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs }}>
            {secondaryBadges.map((reason) => (
              <View
                key={reason}
                style={{ backgroundColor: colors.primarySubtle, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }}
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
