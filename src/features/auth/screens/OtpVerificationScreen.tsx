import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
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

  return <ScreenContainer contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.md }}>
    <View style={{ alignItems: 'flex-start' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Telefon numarası ekranına dön" onPress={handleChangePhone} style={({ pressed }) => ({ alignItems: 'center', backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 })}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>
    </View>

    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: radii.pill, height: 56, justifyContent: 'center', width: 56 }}>
        <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="title" weight="900" style={{ textAlign: 'center' }}>Kodunu gir</AppText>
        <AppText color="muted" style={{ maxWidth: 320, textAlign: 'center' }}>
          {pendingPhoneNumber ? `${maskPhoneNumber(pendingPhoneNumber)} numarasına gönderdiğimiz 6 haneli kodu gir.` : 'Doğrulama oturumu bulunamadı.'}
        </AppText>
      </View>
    </View>

    <View style={{ gap: spacing.md }}>
      <View accessibilityLabel="6 haneli doğrulama kodu" style={{ flexDirection: 'row', gap: spacing.sm }}>
        {digits.map((digit, index) => <TextInput
          key={index}
          ref={(input) => { inputsRef.current[index] = input; }}
          accessibilityLabel={`Doğrulama kodu ${index + 1}. hane`}
          value={digit}
          onChangeText={(value) => updateDigit(index, value)}
          onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus(); }}
          autoFocus={index === 0}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={index === 0 ? otpLength : 1}
          selectTextOnFocus
          style={{ backgroundColor: digit ? colors.primarySubtle : colors.inputBackground, borderColor: error ? colors.danger : digit ? colors.primary : colors.border, borderRadius: radii.md, borderWidth: 1.5, color: colors.textPrimary, flex: 1, fontSize: typography.sizes.subtitle, fontWeight: '800', minHeight: 54, paddingHorizontal: 0, textAlign: 'center' }}
        />)}
      </View>
      {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>{error}</AppText> : null}
      <Button variant="secondary" label="Kodu doğrula" loading={isVerifying} disabled={!pendingPhoneNumber || code.length !== otpLength} onPress={() => void submitCode()} />
    </View>

    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' }}>
        <AppText color="muted" variant="caption">Kod gelmedi mi?</AppText>
        <Pressable accessibilityRole="button" disabled={cooldown > 0 || isResending || !pendingPhoneNumber} onPress={handleResend} style={{ minHeight: 36, justifyContent: 'center' }}>
          <AppText variant="caption" weight="800" color={cooldown > 0 ? 'muted' : 'default'} style={cooldown === 0 ? { color: colors.primary } : undefined}>
            {isResending ? 'Kod gönderiliyor…' : cooldown > 0 ? `Tekrar gönder · ${cooldown} sn` : 'Kodu tekrar gönder'}
          </AppText>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={handleChangePhone} style={{ minHeight: 40, justifyContent: 'center' }}>
        <AppText variant="caption" weight="700" style={{ color: colors.primary }}>Telefon numarasını değiştir</AppText>
      </Pressable>
    </View>
  </ScreenContainer>;
}
