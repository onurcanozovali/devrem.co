import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { MainTabHeader } from '@/components/common/MainTabHeader';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getProvinceName } from '@/data/turkeyProvinces';
import { CampaignPlacement } from '@/features/campaigns/CampaignPlacement';
import { createCampaignContext } from '@/features/campaigns/campaignDomain';
import { ForceAvatar } from '@/features/militaryUnits/ForceAvatar';
import { getForceDisplayName } from '@/features/militaryUnits/forceBranding';
import { usePreparation } from '@/features/preparation/hooks/usePreparation';
import { usePreparationSummary } from '@/features/preparation/hooks/usePreparationSummary';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { getMilitaryPeriodLabel, militaryTypeLabels } from '@/features/profile/profileOptions';
import { formatStoredDate } from '@/features/profile/services/profileValidation';
import { useTheme } from '@/theme/ThemeProvider';
import { getImportantPreparationState, getReportingCountdown, getTimeBasedGreeting } from './services/homeDomain';

export function HomeScreen() {
	const { colors, radii, spacing } = useTheme();
	const { profile, refreshProfile } = useProfile();
	const {
		status: preparationStatus,
		items,
		error: preparationError,
		activatePreparation,
		retryPreparation,
	} = usePreparation();
	const preparationSummary = usePreparationSummary(items);
	const importantPreparation = useMemo(() => getImportantPreparationState(items), [items]);
	const countdown = getReportingCountdown(profile?.reportingDate);

	useFocusEffect(useCallback(() => activatePreparation(), [activatePreparation]));

	const openPreparation = () => router.push('/preparation');

	if (!profile) {
		return (
			<ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
				<EmptyState
					title="Profil bilgileri bulunamadı"
					description="Ana sayfanı hazırlamak için profil bilgilerini tekrar yüklemeyi dene."
					actionLabel="Tekrar yükle"
					onAction={() => void refreshProfile()}
				/>
			</ScreenContainer>
		);
	}

	const militaryCity = getProvinceName(profile.militaryCity);
	const reportingDateLabel = countdown.state === 'unavailable'
		? 'Teslim tarihi doğrulanamadı'
		: formatStoredDate(profile.reportingDate);

	return (
		<ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xxl }}>
			<MainTabHeader title={getTimeBasedGreeting(profile.firstName)} />

			<View
				accessibilityRole="summary"
				accessibilityLabel={getCountdownAccessibilityLabel(countdown.state, countdown.daysRemaining, reportingDateLabel)}
				style={{
					backgroundColor: colors.primary,
					borderRadius: radii.lg,
					gap: spacing.lg,
					padding: spacing.lg,
				}}
			>
				<CountdownHeadline state={countdown.state} daysRemaining={countdown.daysRemaining} />
				<View style={{ gap: spacing.sm }}>
					<HeroDetail icon="calendar-outline" label={reportingDateLabel} />
				</View>
			</View>

			<CampaignPlacement
				placement="home_transport_offer"
				context={createCampaignContext('home_transport_offer', {
					departureCityId: profile.departureCity,
					militaryCityId: profile.militaryCity,
					militaryUnitId: profile.militaryUnitId,
					forceCode: profile.forceCode,
					militaryType: profile.militaryType,
					conscriptionPeriodYear: profile.militaryPeriodYear,
					conscriptionPeriodMonth: profile.militaryPeriodMonth,
					daysUntilService: countdown.state === 'future' || countdown.state === 'today' ? countdown.daysRemaining : undefined,
					serviceDate: profile.reportingDate,
				})}
			/>

			<Pressable
				accessibilityRole={profile.militaryUnitId ? 'button' : undefined}
				accessibilityLabel={profile.militaryUnitId ? 'Birlik bilgilerini aç' : undefined}
				disabled={!profile.militaryUnitId}
				onPress={() => profile.militaryUnitId && router.push({
					pathname: '/military-unit/[unitId]',
					params: { unitId: profile.militaryUnitId },
				})}
				style={({ pressed }) => ({ gap: spacing.md, opacity: pressed ? 0.72 : 1 })}
			>
				<View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
					<ForceAvatar forceCode={profile.forceCode} label="Görev kuvveti" size={48} />
					<View style={{ flex: 1, gap: spacing.xs }}>
					<AppText variant="subtitle" weight="800">Görev yerin</AppText>
					<AppText variant="title" weight="800">{militaryCity}</AppText>
					<AppText color="muted">
						{profile.militaryUnitNameSnapshot ?? profile.militaryUnit ?? 'Birlik bilgisi henüz eklenmedi'}
					</AppText>
					<AppText color="muted" variant="caption">{getForceDisplayName(profile.forceCode)}</AppText>
					</View>
					{profile.militaryUnitId ? <Ionicons color={colors.primary} name="chevron-forward" size={20} /> : null}
				</View>
				<View style={{ flexDirection: 'row', gap: spacing.md }}>
					<DetailBlock label="Askerlik türü" value={militaryTypeLabels[profile.militaryType]} />
					<DetailBlock
						label="Celp dönemi"
						value={getMilitaryPeriodLabel(profile.militaryPeriodYear, profile.militaryPeriodMonth)}
					/>
				</View>
			</Pressable>

			{preparationStatus === 'idle' || preparationStatus === 'loading' ? (
				<PreparationSummaryPlaceholder />
			) : preparationStatus === 'error' ? (
				<Card style={{ gap: spacing.md }}>
					<AppText variant="subtitle" weight="800">Hazırlık bilgilerin yüklenemedi</AppText>
					<AppText color="muted">
						{preparationError ?? 'Hazırlık durumunu şu anda gösteremiyoruz.'}
					</AppText>
					<Button
						accessibilityLabel="Hazırlık bilgilerini tekrar yükle"
						label="Tekrar dene"
						variant="secondary"
						onPress={() => void retryPreparation()}
					/>
				</Card>
			) : preparationSummary.isEmpty ? (
				<Card style={{ gap: spacing.md }}>
					<AppText variant="subtitle" weight="800">Hazırlık planını oluşturmaya başla</AppText>
					<AppText color="muted">
						Sana uygun görevleri görmek ve ilerlemeni takip etmek için Hazırlık bölümünü aç.
					</AppText>
				</Card>
			) : (
				<Card style={{ gap: spacing.md }}>
					<View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm }}>
						<View style={{ flex: 1, gap: spacing.xs }}>
							<AppText variant="subtitle" weight="800">Hazırlığın</AppText>
							<AppText color="muted">
								{preparationSummary.completed} / {preparationSummary.total} görev tamamlandı
							</AppText>
						</View>
						<AppText variant="display" weight="800" style={{ color: colors.primary }}>
							%{preparationSummary.percentage}
						</AppText>
					</View>
					<View
						accessibilityLabel="Hazırlık ilerlemesi"
						accessibilityRole="progressbar"
						accessibilityValue={{
							min: 0,
							max: 100,
							now: preparationSummary.percentage,
							text: `%${preparationSummary.percentage}`,
						}}
						style={{
							backgroundColor: colors.surfaceSecondary,
							borderRadius: radii.pill,
							height: 10,
							overflow: 'hidden',
						}}
					>
						<View style={{
							backgroundColor: colors.primary,
							borderRadius: radii.pill,
							height: '100%',
							width: `${preparationSummary.percentage}%`,
						}} />
					</View>
					<AppText color="muted" weight="600">
						{importantPreparation.remainingCount === 0
							? 'Önemli işlerin tamam'
							: `${importantPreparation.remainingCount} önemli iş kaldı`}
					</AppText>
				</Card>
			)}

			{importantPreparation.nextItems.length > 0 && preparationStatus === 'ready' ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Sıradaki işler. ${importantPreparation.nextItems.map((item) => item.title).join(', ')}. Hazırlığı aç.`}
					onPress={openPreparation}
					style={({ pressed }) => ({ gap: spacing.md, opacity: pressed ? 0.68 : 1 })}
				>
					<View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
						<AppText variant="subtitle" weight="800" style={{ flex: 1 }}>Sıradaki işler</AppText>
						<Ionicons name="arrow-forward" size={20} color={colors.primary} />
					</View>
					<View style={{ gap: spacing.md }}>
						{importantPreparation.nextItems.map((item) => (
							<View key={item.id} style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm }}>
								<View style={{
									borderColor: colors.primary,
									borderRadius: radii.pill,
									borderWidth: 2,
									height: 18,
									marginTop: 3,
									width: 18,
								}} />
								<AppText style={{ flex: 1 }}>{item.title}</AppText>
							</View>
						))}
					</View>
				</Pressable>
			) : null}

			<Button
				accessibilityLabel="Hazırlığa devam et"
				label="Hazırlığa devam et"
				onPress={openPreparation}
			/>
		</ScreenContainer>
	);
}

function PreparationSummaryPlaceholder() {
	const { colors, radii, spacing } = useTheme();
	return (
		<Card
			accessibilityLabel="Hazırlık bilgilerin yükleniyor"
			style={{ gap: spacing.md }}
		>
			<View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
				<View style={{ flex: 1, gap: spacing.sm }}>
					<AppText variant="subtitle" weight="800">Hazırlığın</AppText>
					<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.pill, height: 12, width: '56%' }} />
				</View>
				<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.sm, height: 30, width: 56 }} />
			</View>
			<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.pill, height: 10, width: '100%' }} />
			<AppText color="muted" variant="caption">Hazırlık planın yükleniyor…</AppText>
		</Card>
	);
}

function CountdownHeadline({
	state,
	daysRemaining,
}: {
	state: ReturnType<typeof getReportingCountdown>['state'];
	daysRemaining: number | null;
}) {
	const { colors, spacing } = useTheme();

	if (state === 'future' && daysRemaining !== null) {
		return (
			<View style={{ gap: spacing.xs }}>
				<AppText weight="700" style={{ color: colors.textInverse }}>Teslime</AppText>
				<View style={{ alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
					<AppText variant="display" weight="800" style={{ color: colors.textInverse }}>{daysRemaining}</AppText>
					<AppText variant="subtitle" weight="800" style={{ color: colors.textInverse }}>gün kaldı</AppText>
				</View>
			</View>
		);
	}

	const label = state === 'today'
		? 'Bugün teslim oluyorsun'
		: state === 'past'
			? 'Teslim tarihin geçmiş görünüyor'
			: 'Teslim tarihi görüntülenemedi';
	return <AppText variant="title" weight="800" style={{ color: colors.textInverse }}>{label}</AppText>;
}

function HeroDetail({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
	const { colors, spacing } = useTheme();
	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
			<Ionicons name={icon} size={18} color={colors.textInverse} />
			<AppText variant="caption" style={{ color: colors.textInverse, flex: 1 }}>{label}</AppText>
		</View>
	);
}

function DetailBlock({ label, value }: { label: string; value: string }) {
	const { colors, radii, spacing } = useTheme();
	return (
		<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, flex: 1, gap: spacing.xs, padding: spacing.md }}>
			<AppText color="muted" variant="caption">{label}</AppText>
			<AppText weight="700">{value}</AppText>
		</View>
	);
}

function getCountdownAccessibilityLabel(
	state: ReturnType<typeof getReportingCountdown>['state'],
	daysRemaining: number | null,
	reportingDateLabel: string,
) {
	const headline = state === 'future' && daysRemaining !== null
		? `Teslime ${daysRemaining} gün kaldı.`
		: state === 'today'
			? 'Bugün teslim oluyorsun.'
			: state === 'past'
				? 'Teslim tarihin geçmiş görünüyor.'
				: 'Teslim tarihi görüntülenemedi.';
	return `${headline} ${reportingDateLabel}.`;
}
