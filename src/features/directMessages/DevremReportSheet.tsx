import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { directReportReasons } from '@/services/firebase/directMessages';
import { useTheme } from '@/theme/ThemeProvider';

type ReportReason = typeof directReportReasons[number];

export function DevremReportSheet({ onBlockRequested, onClose, onSubmit, title = 'Kullanıcıyı bildir', visible }: {
  onBlockRequested: () => void;
  onClose: () => void;
  onSubmit: (reason: ReportReason) => Promise<void>;
  title?: string;
  visible: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [status, setStatus] = useState<'choose' | 'loading' | 'success'>('choose');
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const reset = () => { submittingRef.current = false; setReason(null); setStatus('choose'); setError(null); };
  const close = () => { if (status !== 'loading') { reset(); onClose(); } };
  const submit = async () => {
    if (!reason || status === 'loading' || submittingRef.current) return;
    submittingRef.current = true;
    setStatus('loading'); setError(null);
    try { await onSubmit(reason); setStatus('success'); }
    catch { setError('Bildirim gönderilemedi. Tekrar dene.'); setStatus('choose'); }
    finally { submittingRef.current = false; }
  };
  return <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
    <Pressable accessibilityLabel="Bildirim ekranını kapat" onPress={close} style={{ backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }}>
      <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, gap: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md), paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <View style={{ alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, width: 42 }} />
        {status === 'success' ? <>
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}><View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: 30, height: 60, justifyContent: 'center', width: 60 }}><Ionicons color={colors.primary} name="checkmark" size={30} /></View><AppText variant="subtitle" weight="900">Bildirimin alındı</AppText><AppText color="muted" style={{ textAlign: 'center' }}>Geri bildirimin için teşekkürler.{`\n`}Gerekli incelemeyi yapacağız.</AppText></View>
          <Pressable onPress={() => { reset(); onBlockRequested(); }} style={{ alignItems: 'center', borderColor: colors.danger, borderRadius: radii.md, borderWidth: 1, justifyContent: 'center', minHeight: 50 }}><AppText color="danger" weight="800">Kullanıcıyı engelle</AppText></Pressable>
          <Pressable onPress={close} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 50 }}><AppText weight="800" style={{ color: colors.textInverse }}>Tamam</AppText></Pressable>
        </> : <>
          <View><AppText variant="subtitle" weight="900">{title}</AppText><AppText color="muted" variant="caption">Bildirim nedenini seç.</AppText></View>
          <View>{directReportReasons.map((item) => <Pressable key={item} onPress={() => setReason(item)} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 50 }}><Ionicons color={reason === item ? colors.primary : colors.textMuted} name={reason === item ? 'radio-button-on' : 'radio-button-off'} size={22} /><AppText style={{ flex: 1 }} weight={reason === item ? '800' : '500'}>{item}</AppText></Pressable>)}</View>
          {error ? <AppText accessibilityLiveRegion="polite" color="danger" variant="caption">{error}</AppText> : null}
          <Pressable disabled={!reason || status === 'loading'} onPress={() => void submit()} style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 50, opacity: !reason || status === 'loading' ? 0.5 : 1 }}>{status === 'loading' ? <ActivityIndicator color={colors.textInverse} /> : <AppText weight="800" style={{ color: colors.textInverse }}>Bildir</AppText>}</Pressable>
          <Pressable disabled={status === 'loading'} onPress={close} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 46 }}><AppText weight="800" style={{ color: colors.primary }}>Vazgeç</AppText></Pressable>
        </>}
      </Pressable>
    </Pressable>
  </Modal>;
}
