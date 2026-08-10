import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { fetchCommunicationPreference, saveCommunicationPreference } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';

export function CommunicationPreferenceCard() {
  const { session } = useAuth();
  const { colors, spacing } = useTheme();
  const [allowDirectMessages, setAllowDirectMessages] = useState(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void fetchCommunicationPreference(session.userId).then((value) => {
      if (!cancelled) { setAllowDirectMessages(value); setStatus('ready'); }
    }).catch(() => {
      if (!cancelled) { setError('Özel mesaj tercihi yüklenemedi.'); setStatus('ready'); }
    });
    return () => { cancelled = true; };
  }, [session]);

  const updatePreference = async (nextValue: boolean) => {
    if (!session || status === 'saving') return;
    const previousValue = allowDirectMessages;
    setAllowDirectMessages(nextValue);
    setStatus('saving');
    setError(null);
    try {
      await saveCommunicationPreference(session.userId, nextValue);
    } catch {
      setAllowDirectMessages(previousValue);
      setError('Özel mesaj tercihi kaydedilemedi. Tekrar dene.');
    } finally {
      setStatus('ready');
    }
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 64 }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText weight="700">Özel Mesajlar</AppText>
          <AppText color="muted" variant="caption">Devrelerin sana özel mesaj gönderebilir.</AppText>
        </View>
        <Switch
          accessibilityLabel="Özel Mesajlar"
          accessibilityState={{ checked: allowDirectMessages, disabled: status !== 'ready' }}
          disabled={status !== 'ready'}
          ios_backgroundColor={colors.border}
          onValueChange={(value) => void updatePreference(value)}
          thumbColor={colors.surfaceElevated}
          trackColor={{ false: colors.border, true: colors.primary }}
          value={allowDirectMessages}
        />
      </View>
      {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
    </Card>
  );
}
