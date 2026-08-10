import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { useNotifications } from './hooks/useNotifications';
import type { DiscoveryNotificationPreferences } from './types/notifications';

function PreferenceRow({
  description,
  disabled,
  label,
  onChange,
  value,
}: {
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 64, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText weight="700">{label}</AppText>
        <AppText color="muted" variant="caption">{description}</AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        ios_backgroundColor={colors.border}
        onValueChange={onChange}
        thumbColor={colors.surfaceElevated}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

export function NotificationSettingsScreen() {
  const router = useRouter();
  const { colors, radii, spacing } = useTheme();
  const {
    error,
    permission,
    preferences,
    refreshPermission,
    setDiscoveryPreference,
    setEnabled,
    setGroupMessagesEnabled,
    status,
  } = useNotifications();
  const isBusy = status === 'loading' || status === 'saving';
  useFocusEffect(useCallback(() => {
    void refreshPermission();
  }, [refreshPermission]));
  const changeDiscoveryPreference = (
    key: keyof DiscoveryNotificationPreferences,
    enabled: boolean,
  ) => { void setDiscoveryPreference(key, enabled); };

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: radii.md,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            width: 44,
          })}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="title" weight="800" style={{ flex: 1 }}>Bildirimler</AppText>
      </View>

      <Card style={{ gap: spacing.sm }}>
        <PreferenceRow
          description="Devre keşfiyle ilgili bildirimleri al"
          disabled={isBusy}
          label="Bildirimler"
          onChange={(enabled) => void setEnabled(enabled)}
          value={preferences.enabled}
        />
        {permission === 'denied' ? (
          <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.sm, gap: spacing.sm, padding: spacing.md }}>
            <AppText color="muted" variant="caption">Sistem bildirim izni kapalı.</AppText>
            <Button
              label="Sistem ayarlarını aç"
              onPress={() => void Linking.openSettings()}
              variant="secondary"
            />
          </View>
        ) : null}
        {error ? (
          <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={{ gap: spacing.xs, paddingBottom: spacing.sm }}>
          <AppText variant="subtitle" weight="800">Sohbet Bildirimleri</AppText>
          <AppText color="muted" variant="caption">Grubundaki yeni mesajlardan haberdar ol.</AppText>
        </View>
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <PreferenceRow
          description="Devre grubuna yeni mesaj geldiğinde bildir"
          disabled={!preferences.enabled || isBusy}
          label="Devre Grubu Mesajları"
          onChange={(enabled) => void setGroupMessagesEnabled(enabled)}
          value={preferences.groupMessagesEnabled}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={{ gap: spacing.xs, paddingBottom: spacing.sm }}>
          <AppText variant="subtitle" weight="800">Keşif</AppText>
          <AppText color="muted" variant="caption">Aynı devreye katılan kişileri kaçırma.</AppText>
        </View>
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <PreferenceRow
          description="Aynı dönem, şehir, birlik ve askerlik türü"
          disabled={!preferences.enabled || isBusy}
          label="Yeni devre"
          onChange={(enabled) => changeDiscoveryPreference('newDevre', enabled)}
          value={preferences.discovery.newDevre}
        />
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <PreferenceRow
          description="Seninle aynı şehirde yaşayan yeni devre"
          disabled={!preferences.enabled || isBusy}
          label="Aynı şehirde yaşayan"
          onChange={(enabled) => changeDiscoveryPreference('sameResidenceCity', enabled)}
          value={preferences.discovery.sameResidenceCity}
        />
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <PreferenceRow
          description="Seninle aynı şehirden yola çıkacak yeni devre"
          disabled={!preferences.enabled || isBusy}
          label="Aynı şehirden yola çıkan"
          onChange={(enabled) => changeDiscoveryPreference('sameDepartureCity', enabled)}
          value={preferences.discovery.sameDepartureCity}
        />
      </Card>
    </ScreenContainer>
  );
}
