import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { AuthFlowError, mapAuthError } from '../services/authErrors';
import { maskPhoneNumber } from '../services/phoneNumber';

const otpLength = 6;
const resendCooldownSeconds = 60;

export function OtpVerificationScreen() {
  const { pendingPhoneNumber, sendVerificationCode, verifyCode, clearVerification } = useAuth();
  const { colors, radii, spacing, typography } = useTheme();
  const [digits, setDigits] = useState<string[]>(Array.from({ length: otpLength }, () => ''));
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(resendCooldownSeconds);
  const inputsRef = useRef<(TextInput | null)[]>([]);
  const lastSubmittedCodeRef = useRef<string | null>(null);
  const code = digits.join('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submitCode = useCallback(async (verificationCode = code) => {
    if (verificationCode.length !== otpLength || isVerifying || verificationCode === lastSubmittedCodeRef.current) return;
    lastSubmittedCodeRef.current = verificationCode;
    setError(null);
    setIsVerifying(true);
    try {
      await verifyCode(verificationCode);
    } catch (caughtError: unknown) {
      const authError = caughtError instanceof AuthFlowError ? caughtError : mapAuthError(caughtError);
      setError(authError.message);
    } finally {
      setIsVerifying(false);
    }
  }, [code, isVerifying, verifyCode]);

  const updateDigit = (index: number, value: string) => {
    const incomingDigits = value.replace(/\D/g, '').slice(0, otpLength - index).split('');
    const nextDigits = [...digits];

    if (incomingDigits.length === 0) nextDigits[index] = '';
    incomingDigits.forEach((digit, offset) => { nextDigits[index + offset] = digit; });
    setDigits(nextDigits);
    setError(null);
    lastSubmittedCodeRef.current = null;

    const nextIndex = Math.min(index + Math.max(incomingDigits.length, 1), otpLength - 1);
    if (incomingDigits.length > 0 && index + incomingDigits.length < otpLength) inputsRef.current[nextIndex]?.focus();
    const nextCode = nextDigits.join('');
    if (nextCode.length === otpLength) void submitCode(nextCode);
  };

  const handleResend = async () => {
    if (!pendingPhoneNumber || cooldown > 0 || isResending) return;
    setError(null);
    setIsResending(true);
    try {
      await sendVerificationCode(pendingPhoneNumber);
      setCooldown(resendCooldownSeconds);
      setDigits(Array.from({ length: otpLength }, () => ''));
      lastSubmittedCodeRef.current = null;
      inputsRef.current[0]?.focus();
    } catch (caughtError: unknown) {
      const authError = caughtError instanceof AuthFlowError ? caughtError : mapAuthError(caughtError);
      setError(authError.message);
    } finally {
      setIsResending(false);
    }
  };

  const handleChangePhone = () => {
    clearVerification();
    router.replace('/phone');
  };

  return (
    <ScreenContainer>
      <View style={{ gap: spacing.xl, paddingVertical: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" weight="800">Doğrulama kodu</AppText>
          <AppText color="muted">
            {pendingPhoneNumber ? `${maskPhoneNumber(pendingPhoneNumber)} numarasına gönderilen 6 haneli kodu girin.` : 'Doğrulama oturumu bulunamadı.'}
          </AppText>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <View accessibilityLabel="6 haneli doğrulama kodu" style={{ flexDirection: 'row', gap: spacing.sm }}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(input) => { inputsRef.current[index] = input; }}
                accessibilityLabel={`Doğrulama kodu ${index + 1}. hane`}
                value={digit}
                onChangeText={(value) => updateDigit(index, value)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
                }}
                autoFocus={index === 0}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={index === 0 ? otpLength : 1}
                selectTextOnFocus
                style={{
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.danger : colors.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  color: colors.text,
                  flex: 1,
                  fontSize: typography.sizes.subtitle,
                  fontWeight: '700',
                  minHeight: 54,
                  textAlign: 'center',
                }}
              />
            ))}
          </View>

          {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}

          <Button
            label="Kodu doğrula"
            loading={isVerifying}
            disabled={!pendingPhoneNumber || code.length !== otpLength}
            onPress={() => void submitCode()}
          />

          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <Pressable
              accessibilityRole="button"
              disabled={cooldown > 0 || isResending || !pendingPhoneNumber}
              onPress={handleResend}
            >
              <AppText weight="700" color={cooldown > 0 ? 'muted' : 'default'} style={cooldown === 0 ? { color: colors.primary } : undefined}>
                {isResending ? 'Kod gönderiliyor…' : cooldown > 0 ? `Yeni kod gönder (${cooldown} sn)` : 'Yeni kod gönder'}
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleChangePhone}>
              <AppText weight="700" style={{ color: colors.primary }}>Telefon numarasını değiştir</AppText>
            </Pressable>
          </View>
        </Card>
      </View>
    </ScreenContainer>
  );
}
