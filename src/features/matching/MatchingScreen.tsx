import { router, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/EmptyState';
import { MainTabHeader } from '@/components/common/MainTabHeader';
import { AppText } from '@/components/ui/AppText';
import { useProfile } from '@/features/profile/hooks/useProfile';
import type { UserProfile } from '@/features/profile/types/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { DiscoveryProfileRow } from './components/DiscoveryProfileRow';
import { useDiscovery } from './hooks/useDiscovery';
import { getDiscoveryEmptyStateCopy } from './services/discoveryDomain';
import type { PublicProfile } from './types/discovery';

function DiscoverySkeleton() {
	const { colors, spacing } = useTheme();
	return (
		<View accessibilityRole="progressbar" accessibilityLabel="Devreler yükleniyor" style={{ gap: spacing.md }}>
			{[0, 1, 2, 3].map((item) => (
				<View key={item} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 92 }}>
					<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 32, height: 64, width: 64 }} />
					<View style={{ flex: 1, gap: spacing.sm }}>
						<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 4, height: 16, width: '38%' }} />
						<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 4, height: 14, width: '72%' }} />
						<View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 4, height: 12, width: '54%' }} />
					</View>
				</View>
			))}
		</View>
	);
}

function DiscoveryContent({ profile }: { profile: UserProfile }) {
	const { colors, radii, spacing } = useTheme();
	const {
		error,
		hasMore,
		isLoadingMore,
		loadMore,
		loadMoreError,
		profiles,
		reference,
		retry,
		segments,
		selectedSegment,
		setSelectedSegment,
		status,
	} = useDiscovery(profile);
	const canLoadMoreAfterUserScroll = useRef(false);
	const openProfile = useCallback((userId: string) => {
		router.push(`/devre/${userId}` as Href);
	}, []);
	const renderProfile = useCallback(({ item }: { item: PublicProfile }) => (
		<DiscoveryProfileRow
			profile={item}
			reference={reference}
			onPress={openProfile}
		/>
	), [openProfile, reference]);
	const handleEndReached = useCallback(() => {
		if (!canLoadMoreAfterUserScroll.current) return;
		canLoadMoreAfterUserScroll.current = false;
		void loadMore();
	}, [loadMore]);
	const enableScrollPagination = useCallback(() => {
		canLoadMoreAfterUserScroll.current = true;
	}, []);

	return (
		<SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }} edges={['top', 'left', 'right']}>
			<View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
				<MainTabHeader title="Devreni Bul" subtitle="Aynı Devre kimliğindeki askerleri keşfet." />
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: spacing.sm }}
				>
					{segments.map((segment) => {
						const selected = segment.id === selectedSegment;
						return (
							<Pressable
								key={segment.id}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								onPress={() => setSelectedSegment(segment.id)}
								style={({ pressed }) => ({
									alignItems: 'center',
									backgroundColor: selected ? colors.primary : colors.surface,
									borderColor: selected ? colors.primary : colors.border,
									borderRadius: radii.pill,
									borderWidth: 1,
									justifyContent: 'center',
									minHeight: 36,
									opacity: pressed ? 0.8 : 1,
									paddingHorizontal: spacing.md,
								})}
							>
								<AppText style={{ color: selected ? colors.textInverse : colors.textPrimary }} variant="caption" weight="800">
									{segment.label}
								</AppText>
							</Pressable>
						);
					})}
				</ScrollView>
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
				<FlatList<PublicProfile>
					data={profiles}
					keyExtractor={(item) => item.userId}
					renderItem={renderProfile}
					ItemSeparatorComponent={() => <View style={{ backgroundColor: colors.divider, height: 1 }} />}
					ListEmptyComponent={(
						<EmptyState
							title="Henüz eşleşme yok"
							description={getDiscoveryEmptyStateCopy(selectedSegment)}
						/>
					)}
					ListFooterComponent={isLoadingMore ? (
						<View accessibilityRole="progressbar" accessibilityLabel="Daha fazla devre yükleniyor" style={{ alignItems: 'center', minHeight: 48, paddingVertical: spacing.md }}>
							<ActivityIndicator color={colors.primary} />
						</View>
					) : loadMoreError ? (
						<Pressable
							accessibilityRole="button"
							onPress={() => void loadMore()}
							style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.7 : 1, paddingVertical: spacing.md })}
						>
							<AppText color="muted" variant="caption">Daha fazla devre yüklenemedi.</AppText>
							<AppText style={{ color: colors.primary }} variant="caption" weight="800">Tekrar dene</AppText>
						</Pressable>
					) : hasMore && profiles.length < 6 ? (
						<Pressable
							accessibilityRole="button"
							onPress={() => void loadMore()}
							style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.7 : 1, paddingVertical: spacing.md })}
						>
							<AppText style={{ color: colors.primary }} variant="caption" weight="800">Daha fazla eşleşme ara</AppText>
						</Pressable>
					) : null}
					ListHeaderComponent={<View style={{ alignItems: 'center', flexDirection: 'row', paddingBottom: spacing.xs, paddingTop: spacing.sm }}><AppText variant="subtitle" weight="800" style={{ flex: 1 }}>Eşleşmeler</AppText><AppText color="muted" variant="caption" weight="700">{profiles.length} kişi</AppText></View>}
					contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.xs }}
					refreshControl={<RefreshControl refreshing={false} onRefresh={retry} tintColor={colors.primary} />}
					onEndReached={handleEndReached}
					onEndReachedThreshold={0.25}
					onMomentumScrollBegin={enableScrollPagination}
					onScrollBeginDrag={enableScrollPagination}
					initialNumToRender={8}
					maxToRenderPerBatch={8}
					windowSize={7}
				/>
			)}

		</SafeAreaView>
	);
}

export function MatchingScreen() {
	const { colors, spacing } = useTheme();
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
	if (!profile.militaryUnit) {
		return (
			<SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
				<View style={{ gap: spacing.lg, padding: spacing.lg }}>
					<MainTabHeader title="Devreni Bul" subtitle="Aynı Devre kimliğindeki askerleri keşfet." />
					<EmptyState
						title="Birlik bilgini ekle"
						description="Devrelerini bulabilmemiz için görev yapacağın birlik bilgisini profilinden ekle."
					/>
				</View>
			</SafeAreaView>
		);
	}
	return <DiscoveryContent profile={profile} />;
}
