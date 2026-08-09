import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/EmptyState';
import { AppText } from '@/components/ui/AppText';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { getMilitaryPeriodLabel } from '@/features/profile/profileOptions';
import type { UserProfile } from '@/features/profile/types/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { DiscoveryFilterModal } from './components/DiscoveryFilterModal';
import { DiscoveryProfileRow } from './components/DiscoveryProfileRow';
import { useDiscovery } from './hooks/useDiscovery';
import type { PublicProfile } from './types/discovery';

function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
	const { colors, radii, spacing } = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => ({
				alignItems: 'center',
				backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
				borderColor: colors.border,
				borderRadius: radii.pill,
				borderWidth: 1,
				flexDirection: 'row',
				gap: spacing.xs,
				minHeight: 40,
				paddingHorizontal: spacing.md,
			})}
		>
			<AppText variant="caption" weight="700" numberOfLines={1}>{label}</AppText>
			<Ionicons name="chevron-down" size={14} color={colors.textMuted} />
		</Pressable>
	);
}

function DiscoverySkeleton() {
	const { colors, spacing } = useTheme();
	return (
		<View accessibilityRole="progressbar" accessibilityLabel="Devreler yükleniyor" style={{ gap: spacing.md }}>
			{[0, 1, 2, 3].map((item) => (
				<View key={item} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 92 }}>
					<View style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 32, height: 64, width: 64 }} />
					<View style={{ flex: 1, gap: spacing.sm }}>
						<View style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 4, height: 16, width: '38%' }} />
						<View style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 4, height: 14, width: '72%' }} />
						<View style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 4, height: 12, width: '54%' }} />
					</View>
				</View>
			))}
		</View>
	);
}

function DiscoveryContent({ profile }: { profile: UserProfile }) {
	const { colors, spacing } = useTheme();
	const { error, filters, profiles, retry, setFilters, status } = useDiscovery(profile);
	const [filtersVisible, setFiltersVisible] = useState(false);
	const sections = useMemo(() => {
		const sameDestination = profiles.filter((candidate) => candidate.militaryCity === profile.militaryCity);
		const otherProfiles = profiles.filter((candidate) => candidate.militaryCity !== profile.militaryCity);
		return [
			...(sameDestination.length > 0 ? [{ title: 'Aynı Yere Gidenler', data: sameDestination }] : []),
			...(otherProfiles.length > 0 ? [{ title: 'Senin Dönemindeki Diğer Devreler', data: otherProfiles }] : []),
		];
	}, [profile.militaryCity, profiles]);
	const periodLabel = getMilitaryPeriodLabel(filters.militaryPeriodYear, filters.militaryPeriodMonth);
	const destinationLabel = filters.militaryCity === null ? 'Tüm varış şehirleri' : getProvinceName(filters.militaryCity);
	const departureLabel = filters.departureCity === null ? 'Tüm çıkış şehirleri' : getProvinceName(filters.departureCity);

	const openProfile = (userId: string) => {
		router.push(`/devre/${userId}` as Href);
	};

	return (
		<SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }} edges={['top', 'left', 'right']}>
			<View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
				<View style={{ gap: spacing.xs }}>
					<AppText variant="display" weight="900">Devreni Bul</AppText>
					<AppText color="muted">Seninle aynı dönemde gidecek kişileri keşfet.</AppText>
				</View>
				<View style={{ flexDirection: 'row', gap: spacing.sm }}>
					<FilterChip label={periodLabel} onPress={() => setFiltersVisible(true)} />
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Keşif filtrelerini aç"
						onPress={() => setFiltersVisible(true)}
						style={({ pressed }) => ({
							alignItems: 'center',
							backgroundColor: pressed ? colors.surfaceSubtle : colors.primary,
							borderRadius: 20,
							height: 40,
							justifyContent: 'center',
							width: 40,
						})}
					>
						<Ionicons name="options-outline" size={20} color={colors.onPrimary} />
					</Pressable>
				</View>
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
					<FilterChip label={destinationLabel} onPress={() => setFiltersVisible(true)} />
					<FilterChip label={departureLabel} onPress={() => setFiltersVisible(true)} />
				</View>
			</View>

			{status === 'loading' ? (
				<View style={{ padding: spacing.lg }}><DiscoverySkeleton /></View>
			) : status === 'error' ? (
				<EmptyState
					title="Devreler yüklenemedi"
					description={error ?? 'Bağlantını kontrol edip tekrar dene.'}
					actionLabel="Tekrar dene"
					onAction={retry}
				/>
			) : (
				<SectionList<PublicProfile>
					sections={sections}
					keyExtractor={(item) => item.userId}
					renderItem={({ item }) => <DiscoveryProfileRow profile={item} onPress={openProfile} />}
					renderSectionHeader={({ section }) => (
						<View style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
							<AppText variant="subtitle" weight="800">{section.title}</AppText>
						</View>
					)}
					ItemSeparatorComponent={() => <View style={{ backgroundColor: colors.border, height: 1 }} />}
					ListEmptyComponent={(
						<EmptyState
							title="Henüz eşleşme yok"
							description="Bu filtrelerle eşleşen bir devre bulunamadı. Şehir filtrelerini genişleterek tekrar deneyebilirsin."
							actionLabel="Filtreleri genişlet"
							onAction={() => setFilters({ ...filters, militaryCity: null, departureCity: null })}
						/>
					)}
					contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
					refreshControl={<RefreshControl refreshing={false} onRefresh={retry} tintColor={colors.primary} />}
					stickySectionHeadersEnabled={false}
					initialNumToRender={8}
					maxToRenderPerBatch={8}
					windowSize={7}
				/>
			)}

			{filtersVisible ? (
				<DiscoveryFilterModal
					filters={filters}
					profile={profile}
					onClose={() => setFiltersVisible(false)}
					onApply={(nextFilters) => {
						setFiltersVisible(false);
						setFilters(nextFilters);
					}}
				/>
			) : null}
		</SafeAreaView>
	);
}

export function MatchingScreen() {
	const { profile } = useProfile();
	if (!profile) {
		return (
			<SafeAreaView style={{ flex: 1 }}>
				<EmptyState
					title="Profilini tamamla"
					description="Devrelerini keşfetmek için askerlik bilgilerini tamamlaman gerekiyor."
				/>
			</SafeAreaView>
		);
	}
	return <DiscoveryContent profile={profile} />;
}
