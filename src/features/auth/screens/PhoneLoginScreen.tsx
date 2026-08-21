import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getLegalDocumentPath, type LegalDocumentId } from '@/features/legal/legalDomain';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { AuthFlowError, mapAuthError } from '../services/authErrors';
import { formatTurkishPhoneInput, normalizeTurkishPhoneNumber } from '../services/phoneNumber';

const continuedLegalState = { termsAccepted: true, privacyNoticeAcknowledged: true } as const;

function LegalLink({ documentId, children }: { documentId: LegalDocumentId; children: string }) {
  const { colors } = useTheme();
  return <AppText accessibilityRole="link" onPress={() => router.push(getLegalDocumentPath(documentId) as Href)} variant="caption" weight="700" style={{ color: colors.primary, textDecorationLine: 'underline' }}>{children}</AppText>;
}

function BrandLogo() {
  return <View style={{ alignItems: 'center', height: 50, justifyContent: 'center', overflow: 'hidden', width: 200 }}>
    <Image accessibilityLabel="Devrem" resizeMode="contain" source={require('../../../../assets/branding/logo.png')} style={{ height: 200, position: 'absolute', top: -70, width: 200 }} />
  </View>;
}

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
      await sendVerificationCode(phoneNumber, continuedLegalState);
      router.push('/verify');
    } catch (caughtError: unknown) {
      const authError = caughtError instanceof AuthFlowError ? caughtError : mapAuthError(caughtError);
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <ScreenContainer contentContainerStyle={{ paddingBottom: spacing.md }}>
    <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
      <View style={{ alignItems: 'center', gap: spacing.lg }}>
        <BrandLogo />
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="title" weight="900" style={{ textAlign: 'center' }}>Telefon numaran</AppText>
          <AppText color="muted" style={{ textAlign: 'center' }}>Sana doğrulama kodu göndereceğiz.</AppText>
        </View>
      </View>

      <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, padding: spacing.md }}>
        <TextField
          label="Cep telefonu numarası"
          prefix="+90"
          value={phoneInput}
          onChangeText={(value) => { setPhoneInput(formatTurkishPhoneInput(value)); if (error) setError(null); }}
          error={error}
          placeholder="5XX XXX XX XX"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={13}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />
        <Button label="Devam et" loading={isSubmitting} onPress={handleContinue} />
      </View>
    </View>

    <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: 'auto', paddingHorizontal: spacing.sm, paddingTop: spacing.lg }}>
      <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
      <AppText color="muted" variant="caption" style={{ textAlign: 'center' }}>
        Devam ederek <LegalLink documentId="terms">Kullanıcı Sözleşmesi</LegalLink>’ni kabul eder ve <LegalLink documentId="privacy-notice">KVKK Aydınlatma Metni</LegalLink> kapsamında bilgilendirildiğini onaylarsın.
      </AppText>
      <AppText color="muted" variant="caption" style={{ textAlign: 'center' }}>Numaran yalnızca hesap doğrulama ve güvenlik amacıyla kullanılır.</AppText>
    </View>
  </ScreenContainer>;
}
