import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { AuthFlowError, mapAuthError } from '../services/authErrors';
import { formatTurkishPhoneInput, normalizeTurkishPhoneNumber } from '../services/phoneNumber';

export function PhoneLoginScreen() {
  const { sendVerificationCode } = useAuth();
  const { colors, radii, spacing } = useTheme();
  const [phoneInput, setPhoneInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setError(null);

    try {
      const phoneNumber = normalizeTurkishPhoneNumber(phoneInput);
      setIsSubmitting(true);
      await sendVerificationCode(phoneNumber);
      router.push('/verify');
    } catch (caughtError: unknown) {
      const authError = caughtError instanceof AuthFlowError ? caughtError : mapAuthError(caughtError);
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ justifyContent: 'space-between' }}>
      <View style={{ gap: spacing.xl, paddingVertical: spacing.lg }}>
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <AppText weight="800" style={{ color: colors.primary }}>DEVREM</AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" weight="800">Telefon numaranızla devam edin</AppText>
          <AppText color="muted">Askere hazırlanmanın tek uygulaması.</AppText>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <TextField
            label="Cep telefonu numarası"
            prefix="+90"
            value={phoneInput}
            onChangeText={(value) => {
              setPhoneInput(formatTurkishPhoneInput(value));
              if (error) setError(null);
            }}
            error={error}
            placeholder="5XX XXX XX XX"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            maxLength={13}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <Button label="Doğrulama kodu gönder" loading={isSubmitting} onPress={handleContinue} />
        </Card>
      </View>

      <AppText color="muted" variant="caption" style={{ textAlign: 'center', paddingBottom: spacing.md }}>
        {"Devam ederek Kullanım Koşulları'nı ve KVKK Aydınlatma Metni'ni kabul etmiş olursunuz. Numaranız doğrulama amacıyla Firebase Authentication tarafından işlenir."}
      </AppText>
    </ScreenContainer>
  );
}
