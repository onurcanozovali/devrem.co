import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { canSubmitRegistration, createRegistrationLegalState, getLegalDocumentPath, type LegalDocumentId } from './legalDomain';

function UpdateRow({ checked, documentId, text, linkText, onChange }: { checked: boolean; documentId: LegalDocumentId; text: string; linkText: string; onChange: () => void }) {
  const { colors, radii, spacing } = useTheme();
  return <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm }}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onChange} style={{ alignItems: 'center', borderColor: checked ? colors.primary : colors.border, borderRadius: radii.sm, borderWidth: 2, height: 24, justifyContent: 'center', marginTop: 2, width: 24 }}>
      {checked ? <AppText weight="900" style={{ color: colors.primary, lineHeight: 18 }}>✓</AppText> : null}
    </Pressable>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push(getLegalDocumentPath(documentId) as Href)}>
        <AppText><AppText weight="700" style={{ color: colors.primary }}>{linkText}</AppText>{text}</AppText>
      </Pressable>
    </View>
  </View>;
}

export function LegalUpdateScreen() {
  const { acceptLegalUpdate, legalError } = useAuth();
  const { spacing } = useTheme();
  const [state, setState] = useState(createRegistrationLegalState);
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!canSubmitRegistration(state) || submitting) return;
    setSubmitting(true);
    try { await acceptLegalUpdate(); } finally { setSubmitting(false); }
  };
  return <ScreenContainer contentContainerStyle={{ gap: spacing.xl, justifyContent: 'center' }}>
    <View style={{ gap: spacing.sm }}>
      <AppText variant="title" weight="800">Yasal metinler güncellendi</AppText>
      <AppText color="muted">Devrem’i kullanmaya devam etmeden önce güncel metinleri incelemeni istiyoruz.</AppText>
    </View>
    <View style={{ gap: spacing.lg }}>
      <UpdateRow checked={state.termsAccepted} documentId="terms" linkText="Kullanıcı Sözleşmesi" text="'ni okudum ve kabul ediyorum." onChange={() => setState((current) => ({ ...current, termsAccepted: !current.termsAccepted }))} />
      <UpdateRow checked={state.privacyNoticeAcknowledged} documentId="privacy-notice" linkText="KVKK Aydınlatma Metni" text="'ni okudum ve kişisel verilerimin işlenmesi hakkında bilgilendirildim." onChange={() => setState((current) => ({ ...current, privacyNoticeAcknowledged: !current.privacyNoticeAcknowledged }))} />
    </View>
    {legalError ? <AppText color="danger" variant="caption">{legalError}</AppText> : null}
    <Button label="Devam et" disabled={!canSubmitRegistration(state)} loading={submitting} onPress={() => void submit()} />
  </ScreenContainer>;
}
