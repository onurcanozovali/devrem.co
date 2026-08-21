import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { DevremNoticeModal } from '@/components/ui/DevremNoticeModal';
import { CampaignPlacement } from '@/features/campaigns/CampaignPlacement';
import { createCampaignContext } from '@/features/campaigns/campaignDomain';
import { useTheme } from '@/theme/ThemeProvider';
import { getMilitaryUnitById } from './catalog';
import { ForceAvatar } from './ForceAvatar';
import { getForceDisplayName } from './forceBranding';
import type { CanonicalMilitaryUnit, MilitaryUnitFacility } from './types';

type IconName = ComponentProps<typeof Ionicons>['name'];

const facilityIcons: Readonly<Record<string, IconName>> = {
  canteen: 'basket-outline',
  cafeteria: 'cafe-outline',
  atm: 'card-outline',
  bank: 'business-outline',
  ptt: 'mail-outline',
  infirmary: 'medkit-outline',
  barber: 'cut-outline',
  tailor: 'shirt-outline',
  laundry: 'water-outline',
  sports: 'barbell-outline',
  library: 'library-outline',
  payphone: 'call-outline',
  stationery: 'pencil-outline',
  market: 'storefront-outline',
};

function formatDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function verificationLabel(status: string): string {
  switch (status) {
    case 'verified_current_public_source': return 'Güncel kamu kaynaklarıyla doğrulandı';
    case 'verified_public_navigation_point': return 'Navigasyon noktası doğrulandı';
    case 'verified_present': return 'Doğrulandı';
    case 'community_confirmed': return 'Topluluk tarafından doğrulandı';
    case 'verified_absent': return 'Bulunmadığı doğrulandı';
    default: return 'Bilgi doğrulama sürecinde';
  }
}

function mapTarget(unit: CanonicalMilitaryUnit): string {
  if (unit.mapCoordinates) return `${unit.mapCoordinates.lat},${unit.mapCoordinates.lng}`;
  return unit.mapSearchQuery
    ?? unit.publicAddressDisplayValue
    ?? [unit.name, unit.district, unit.cityName].filter(Boolean).join(', ');
}

export function mapCoordinateLabel(unit: Pick<CanonicalMilitaryUnit, 'coordinateStatus' | 'mapCoordinates'>): string {
  if (!unit.mapCoordinates) return 'Birlik adına göre haritada aranır';
  return unit.coordinateStatus === 'verified_public_navigation_point'
    ? 'Kamu kaynağında doğrulanmış navigasyon noktası'
    : 'Kamuya açık kaynaklardan yaklaşık konum';
}

function openMap(unit: CanonicalMilitaryUnit, directions: boolean, onError: () => void): void {
  const target = encodeURIComponent(mapTarget(unit));
  const url = directions
    ? `https://www.google.com/maps/dir/?api=1&destination=${target}`
    : `https://www.google.com/maps/search/?api=1&query=${target}`;
  void Linking.openURL(url).catch(onError);
}

function openSource(url: string, onError: () => void): void {
  void Linking.openURL(url).catch(onError);
}

export function MilitaryUnitInfoScreen() {
  const params = useLocalSearchParams<{ unitId?: string | string[] }>();
  const unitId = typeof params.unitId === 'string' ? params.unitId : '';
  const unit = getMilitaryUnitById(unitId);
  const { colors, radii, spacing } = useTheme();
  const [notice, setNotice] = useState<{ description: string; title: string } | null>(null);
  if (!unit) return <ScreenContainer><EmptyState title="Birlik bulunamadı" description="Bu birlik katalogda yer almıyor veya artık aktif değil." /></ScreenContainer>;

  const visibleFacilities = unit.facilities.filter((facility) => facility.displayInApp);
  const transportation = unit.transportationDisplayInApp ? unit.transportationDisplayValue : null;
  const locationLabel = unit.publicAddressDisplayValue
    ?? [unit.name, unit.district, unit.cityName].filter(Boolean).join(', ');
  const verifiedAt = formatDate(unit.verifiedAt);
  const details = [
    ['Kuvvet', getForceDisplayName(unit.forceCode)],
    ['Şehir / ilçe', [unit.cityName, unit.district].filter(Boolean).join(' / ')],
    ...(unit.shortName && unit.shortName !== unit.name ? [['Kısa ad', unit.shortName]] : []),
    ['Bilgi durumu', verificationLabel(unit.verificationStatus)],
    ...(verifiedAt ? [['Son güncelleme', verifiedAt]] : []),
  ];

  return <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xxl }}>
    <View style={{ alignItems: 'center', flexDirection: 'row' }}>
      <Pressable accessibilityLabel="Geri dön" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={{ padding: spacing.sm }}>
        <Ionicons color={colors.textPrimary} name="arrow-back" size={26} />
      </Pressable>
      <AppText style={{ flex: 1 }} variant="subtitle" weight="900">Birlik Bilgisi</AppText>
    </View>

    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <ForceAvatar forceCode={unit.forceCode} label={unit.name} size={92} />
      <AppText style={{ textAlign: 'center' }} variant="title" weight="900">{unit.name}</AppText>
      <AppText color="muted">{getForceDisplayName(unit.forceCode)}</AppText>
      <View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Ionicons color={colors.primary} name="shield-checkmark-outline" size={15} />
        <AppText variant="caption" weight="800" style={{ color: colors.primary }}>{verificationLabel(unit.verificationStatus)}</AppText>
      </View>
    </View>

    {unit.shortInfo ? <Section title="Birlik hakkında">
      <AppText color="muted" style={{ lineHeight: 24 }}>{unit.shortInfo}</AppText>
    </Section> : null}

    {unit.mapShowInApp ? <Section title="Konum ve yol tarifi">
      <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, overflow: 'hidden', padding: spacing.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: radii.md, height: 52, justifyContent: 'center', width: 52 }}>
            <Ionicons color={colors.primary} name="location" size={27} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText weight="800">{locationLabel}</AppText>
            <AppText color="muted" variant="caption">
              {mapCoordinateLabel(unit)}
            </AppText>
          </View>
        </View>
        {unit.mapCoordinates ? <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: spacing.sm }}>
          <AppText color="muted" variant="caption" style={{ textAlign: 'center' }}>
            {unit.mapCoordinates.lat.toFixed(6)}, {unit.mapCoordinates.lng.toFixed(6)}
          </AppText>
        </View> : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <MapAction icon="map-outline" label="Haritada aç" onPress={() => openMap(unit, false, () => setNotice({ title: 'Harita açılamadı', description: 'Cihazındaki harita uygulamasını veya internet bağlantını kontrol et.' }))} secondary />
          {unit.mapCanOpenDirections ? <MapAction icon="navigate" label="Yol tarifi al" onPress={() => openMap(unit, true, () => setNotice({ title: 'Harita açılamadı', description: 'Cihazındaki harita uygulamasını veya internet bağlantını kontrol et.' }))} /> : null}
        </View>
      </View>
    </Section> : null}

    <Section title="Birlik detayları">
      <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' }}>
        {details.map(([label, value], index) => <View key={label} style={{ borderBottomColor: colors.divider, borderBottomWidth: index < details.length - 1 ? 1 : 0, gap: 3, paddingHorizontal: spacing.md, paddingVertical: 13 }}>
          <AppText color="muted" variant="caption">{label}</AppText>
          <AppText weight="700">{value}</AppText>
        </View>)}
      </View>
    </Section>

    {transportation ? <Section title="Ulaşım">
      <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Ionicons color={colors.primary} name="bus-outline" size={22} />
          <AppText weight="800">Birliğe ulaşım</AppText>
        </View>
        <AppText color="muted" style={{ lineHeight: 24 }}>{transportation}</AppText>
        <AppText color="muted" variant="caption">{verificationLabel(unit.transportationDisplayStatus)}</AppText>
      </View>
    </Section> : null}

    <CampaignPlacement
      placement="unit_transport_offer"
      context={createCampaignContext('unit_transport_offer', {
        militaryCityId: unit.cityCode,
        militaryUnitId: unit.id,
        forceCode: unit.forceCode,
      })}
    />

    {visibleFacilities.length ? <Section subtitle="Doğrulanmayı bekleyen yerel bilgiler de açıkça işaretlenerek gösterilir." title="Birlikteki imkânlar">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {visibleFacilities.map((facility) => <FacilityCard facility={facility} key={facility.code} />)}
      </View>
    </Section> : null}

    {unit.verificationSources.length ? <Section subtitle="Birlik kimliği ve genel bilgiler için kullanılan güncel kaynaklar." title="Bilgi kaynakları">
      <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' }}>
        {unit.verificationSources.map((source, index) => <Pressable
          accessibilityLabel={`${source.authority} kaynağını aç`}
          accessibilityRole="link"
          key={`${source.authority}-${source.url}`}
          onPress={() => openSource(source.url, () => setNotice({ title: 'Kaynak açılamadı', description: 'Bağlantı şu anda açılamıyor.' }))}
          style={({ pressed }) => ({ alignItems: 'center', backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated, borderBottomColor: colors.divider, borderBottomWidth: index < unit.verificationSources.length - 1 ? 1 : 0, flexDirection: 'row', gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm })}
        >
          <Ionicons color={colors.primary} name="document-text-outline" size={20} />
          <AppText numberOfLines={2} style={{ flex: 1 }} weight="700">{source.authority}</AppText>
          <Ionicons color={colors.textMuted} name="open-outline" size={18} />
        </Pressable>)}
      </View>
    </Section> : null}
    <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: spacing.md }}>
      <AppText color="muted" variant="caption" style={{ lineHeight: 19 }}>
        Devrem, MSB/TSK veya başka bir kamu kurumunun resmî hizmeti değildir. Konum ve birlik bilgileri yardımcı niteliktedir; sevk belgen ve resmî kaynaklardaki bilgiler esastır.
      </AppText>
    </View>
    <DevremNoticeModal description={notice?.description ?? ''} onClose={() => setNotice(null)} title={notice?.title ?? ''} visible={notice !== null} />
  </ScreenContainer>;
}

function Section({ children, subtitle, title }: { children: ReactNode; subtitle?: string; title: string }) {
  const { spacing } = useTheme();
  return <View style={{ gap: spacing.sm }}>
    <AppText variant="subtitle" weight="900">{title}</AppText>
    {subtitle ? <AppText color="muted" variant="caption">{subtitle}</AppText> : null}
    {children}
  </View>;
}

function MapAction({ icon, label, onPress, secondary = false }: { icon: IconName; label: string; onPress: () => void; secondary?: boolean }) {
  const { colors, radii, spacing } = useTheme();
  return <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => ({
      alignItems: 'center',
      backgroundColor: secondary ? pressed ? colors.surfaceSecondary : colors.surfaceElevated : pressed ? colors.primaryPressed : colors.primary,
      borderColor: secondary ? colors.border : 'transparent',
      borderRadius: radii.md,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: spacing.sm,
    })}
  >
    <Ionicons color={secondary ? colors.primary : colors.textInverse} name={icon} size={18} />
    <AppText weight="800" style={{ color: secondary ? colors.primary : colors.textInverse, fontSize: 14 }}>{label}</AppText>
  </Pressable>;
}

function FacilityCard({ facility }: { facility: MilitaryUnitFacility }) {
  const { colors, radii, spacing } = useTheme();
  const verified = facility.status === 'verified_present';
  const communityConfirmed = facility.status === 'community_confirmed';
  const absent = facility.status === 'verified_absent';
  const stateColor = verified || communityConfirmed ? colors.success : absent ? colors.danger : colors.warning;
  const stateLabel = verified ? 'Doğrulandı' : communityConfirmed ? 'Toplulukça doğrulandı' : absent ? 'Bulunmuyor' : 'Ön bilgi';
  const displayName = facility.displayClaim ?? facility.label;
  return <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexBasis: '47%', flexGrow: 1, gap: spacing.sm, minHeight: 126, padding: 12 }}>
    <View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 }}>
      <Ionicons color={colors.primary} name={facilityIcons[facility.code] ?? 'business-outline'} size={21} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <AppText numberOfLines={3} weight="800" style={{ fontSize: 14, lineHeight: 18 }}>{displayName}</AppText>
      {displayName !== facility.label ? <AppText color="muted" variant="caption">{facility.label}</AppText> : null}
    </View>
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 5 }}>
      <View style={{ backgroundColor: stateColor, borderRadius: 999, height: 6, width: 6 }} />
      <AppText variant="caption" weight="700" style={{ color: stateColor }}>{stateLabel}</AppText>
    </View>
  </View>;
}
