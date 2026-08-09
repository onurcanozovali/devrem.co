import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AccountDeletionError } from '@/features/auth/services/accountDeletionErrors';
import { AuthFlowError, mapAuthError } from '@/features/auth/services/authErrors';
import { maskPhoneNumber } from '@/features/auth/services/phoneNumber';
import { useTheme } from '@/theme/ThemeProvider';

type DeletionStage = 'explanation' | 'confirmation' | 'verification';

interface AccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AccountDeletionError || error instanceof AuthFlowError) return error.message;
  return mapAuthError(error).message;
}

export function AccountDeletionModal({ visible, onClose }: AccountDeletionModalProps) {
  const {
    accountPhoneNumber,
    clearAccountDeletionVerification,
    confirmAccountDeletionCode,
    deleteAccount,
    sendAccountDeletionCode,
  } = useAuth();
  const { colors, radii, spacing } = useTheme();
  const [stage, setStage] = useState<DeletionStage>('explanation');
  const [confirmationText, setConfirmationText] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const confirmed = confirmationText.trim().toLocaleUpperCase('tr-TR') === 'SİL';

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const close = () => {
    if (isWorking) return;
    clearAccountDeletionVerification();
    onClose();
  };

  const requestVerificationCode = async () => {
    await sendAccountDeletionCode();
    setCooldown(60);
    setStage('verification');
  };

  const sendVerificationCode = async () => {
    if (isWorking || cooldown > 0) return;
    setError(null);
    setIsWorking(true);
    try {
      await requestVerificationCode();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsWorking(false);
    }
  };

  const handleDelete = async () => {
    if (isWorking || !confirmed) return;
    setError(null);
    setIsWorking(true);
    try {
      await deleteAccount();
    } catch (caughtError: unknown) {
      if (caughtError instanceof AccountDeletionError && caughtError.code === 'recent-auth-required') {
        try {
          await requestVerificationCode();
        } catch (verificationError: unknown) {
          setError(getErrorMessage(verificationError));
        }
        return;
      }
      setError(getErrorMessage(caughtError));
    } finally {
      setIsWorking(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (isWorking || verificationCode.length !== 6) return;
    setError(null);
    setIsWorking(true);
    try {
      await confirmAccountDeletionCode(verificationCode);
      await deleteAccount();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="800">Hesabı sil</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hesap silme ekranını kapat"
            disabled={isWorking}
            hitSlop={12}
            onPress={close}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}
          >
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>

        {stage === 'explanation' ? (
          <>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radii.md,
                gap: spacing.md,
                padding: spacing.xl,
              }}
            >
              <Ionicons name="warning-outline" size={34} color={colors.danger} />
              <AppText variant="subtitle" weight="800" style={{ textAlign: 'center' }}>
                Bu işlem kalıcıdır
              </AppText>
              <AppText color="muted" style={{ textAlign: 'center' }}>
                Profilin, hazırlık listen ve hesabına ait tüm veriler kalıcı olarak silinir. Bu işlem geri alınamaz.
              </AppText>
            </View>
            <View style={{ gap: spacing.md }}>
              <Button label="Hesabı silmeye devam et" variant="secondary" onPress={() => setStage('confirmation')} />
              <Button label="Vazgeç" variant="secondary" onPress={close} />
            </View>
          </>
        ) : null}

        {stage === 'confirmation' ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="subtitle" weight="800">Silme işlemini onayla</AppText>
              <AppText color="muted">
                Devam etmek için aşağıdaki alana SİL yaz. Oturumun eskiyse telefon numaranı yeniden doğrulaman istenecek.
              </AppText>
            </View>
            <TextField
              label="Onay"
              value={confirmationText}
              onChangeText={(value) => {
                setConfirmationText(value);
                setError(null);
              }}
              placeholder="SİL"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={3}
            />
            {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
            <Button
              label="Hesabımı kalıcı olarak sil"
              variant="danger"
              loading={isWorking}
              disabled={!confirmed}
              onPress={() => void handleDelete()}
            />
            <Button label="Vazgeç" variant="secondary" disabled={isWorking} onPress={close} />
          </>
        ) : null}

        {stage === 'verification' ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="subtitle" weight="800">Telefonunu doğrula</AppText>
              <AppText color="muted">
                {accountPhoneNumber
                  ? `${maskPhoneNumber(accountPhoneNumber)} numarasına gönderilen 6 haneli kodu gir.`
                  : 'Telefonuna gönderilen 6 haneli doğrulama kodunu gir.'}
              </AppText>
              <AppText color="muted" variant="caption">
                Doğrulama tamamlanmadan hiçbir verin silinmez.
              </AppText>
            </View>
            <TextField
              label="Doğrulama kodu"
              value={verificationCode}
              onChangeText={(value) => {
                setVerificationCode(value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
            />
            {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
            <Button
              label="Doğrula ve hesabımı sil"
              variant="danger"
              loading={isWorking}
              disabled={verificationCode.length !== 6}
              onPress={() => void handleVerifyAndDelete()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: cooldown > 0 || isWorking }}
              disabled={cooldown > 0 || isWorking}
              onPress={() => void sendVerificationCode()}
              style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
            >
              <AppText weight="700" style={{ color: cooldown > 0 ? colors.textMuted : colors.primary }}>
                {cooldown > 0 ? `Yeni kod için ${cooldown} sn` : 'Kodu yeniden gönder'}
              </AppText>
            </Pressable>
            <Button label="Vazgeç" variant="secondary" disabled={isWorking} onPress={close} />
          </>
        ) : null}
      </ScreenContainer>
    </Modal>
  );
}
