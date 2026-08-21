import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { MainTabHeader } from '@/components/common/MainTabHeader';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DevremConfirmModal } from '@/components/ui/DevremConfirmModal';
import { CampaignPlacement } from '@/features/campaigns/CampaignPlacement';
import { createCampaignContext } from '@/features/campaigns/campaignDomain';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import {
  PreparationItemFormModal,
  type PreparationFormMode,
} from './components/PreparationItemFormModal';
import { PreparationItemRow } from './components/PreparationItemRow';
import { usePreparation } from './hooks/usePreparation';
import { usePreparationSummary } from './hooks/usePreparationSummary';
import { PREPARATION_CATEGORIES } from './preparationCategories';
import type { PreparationItem, PreparationItemInput } from './types/preparation';

interface FormState {
  mode: PreparationFormMode;
  item: PreparationItem | null;
}

export function PreparationScreen() {
  const { colors, radii, spacing } = useTheme();
  const { profile } = useProfile();
  const {
    status,
    items,
    state,
    error,
    actionError,
    activatePreparation,
    retryPreparation,
    addItem,
    editItem,
    toggleItem,
    deleteItem,
    restoreDefaults,
    dismissHint,
    clearActionError,
  } = usePreparation();
  const summary = usePreparationSummary(items);
  const [collapsedCategories, setCollapsedCategories] = useState<ReadonlySet<string>>(new Set());
  const [actionsItemId, setActionsItemId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PreparationItem | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  useFocusEffect(useCallback(() => activatePreparation(), [activatePreparation]));

  const sections = useMemo(() => {
    const defaultSections = PREPARATION_CATEGORIES.map((category) => ({
      ...category,
      items: items.filter((item) => item.source === 'default' && item.category === category.id),
    })).filter((section) => section.items.length > 0);
    const customItems = items.filter((item) => item.source === 'custom');
    return customItems.length > 0
      ? [...defaultSections, { id: 'custom', label: 'Benim Eklediklerim', shortDescription: 'Kendi oluşturduğun görevler', items: customItems }]
      : defaultSections;
  }, [items]);

  const closeItemActions = useCallback(() => setActionsItemId(null), []);

  const openItemActions = useCallback((item: PreparationItem) => {
    setActionsItemId(item.id);
    if (!state?.longPressHintDismissed) void dismissHint();
  }, [dismissHint, state?.longPressHintDismissed]);

  const editItemFromActions = useCallback((item: PreparationItem) => {
    setActionsItemId(null);
    setFormState({ mode: 'edit', item });
  }, []);

  const requestDelete = useCallback((item: PreparationItem) => {
    setActionsItemId(null);
    setDeleteConfirmItem(item);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmItem) return;
    const item = deleteConfirmItem;
    setDeleteConfirmItem(null);
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    void deleteItem(item).catch(() => undefined);
  }, [deleteConfirmItem, deleteItem]);

  const togglePreparationItem = useCallback((itemId: string) => {
    setActionsItemId(null);
    void toggleItem(itemId).catch(() => undefined);
  }, [toggleItem]);

  const submitForm = async (input: PreparationItemInput) => {
    if (formState?.mode === 'create') {
      await addItem(input);
      return;
    }
    if (!formState?.item) throw new Error('Düzenlenecek görev bulunamadı.');
    await editItem(formState.item, input);
  };

  const runRestore = async () => {
    setRestoring(true);
    setNotice(null);
    try {
      const restoredCount = await restoreDefaults();
      setNotice(restoredCount > 0
        ? `${restoredCount} eksik varsayılan görev geri eklendi. Kendi görevlerin korunuyor.`
        : 'Varsayılan görevlerin zaten eksiksiz.');
    } catch {
      // The provider exposes a non-intrusive error banner.
    } finally {
      setRestoring(false);
    }
  };

  const confirmRestore = () => {
    setRestoreConfirmOpen(true);
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <LoadingState label="Hazırlık listen hazırlanıyor…" />
      </ScreenContainer>
    );
  }

  if (status === 'error') {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState
          title="Hazırlık listesi yüklenemedi"
          description={error ?? 'Liste hazırlanırken bir sorun oluştu.'}
          actionLabel="Tekrar dene"
          onAction={() => void retryPreparation()}
        />
      </ScreenContainer>
    );
  }

  return (
    <>
      <ScreenContainer contentContainerStyle={{ paddingBottom: spacing.xxl }} onScrollBeginDrag={closeItemActions}>
        <Pressable accessible={false} onPress={closeItemActions} style={{ gap: spacing.lg }}>
        <MainTabHeader title="Hazırlık" subtitle="Kişisel hazırlık planın" action={<Pressable
            accessibilityRole="button"
            accessibilityLabel="Görev ekle"
            onPress={() => setFormState({ mode: 'create', item: null })}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              borderRadius: radii.pill,
              flexDirection: 'row',
              gap: spacing.sm,
              minHeight: 46,
              paddingHorizontal: spacing.md,
            })}
          >
            <Ionicons name="add" size={21} color={colors.textInverse} />
            <AppText weight="700" style={{ color: colors.textInverse }}>Görev ekle</AppText>
          </Pressable>} />

        <Card accessibilityLabel={`Hazırlığın yüzde ${summary.percentage} tamamlandı. ${summary.completed} / ${summary.total} görev tamamlandı.`}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <AppText variant="display" weight="800" style={{ color: colors.primary }}>%{summary.percentage}</AppText>
            <AppText color="muted" style={{ flex: 1, paddingBottom: spacing.xs }}>tamamlandı</AppText>
            <AppText weight="700" style={{ paddingBottom: spacing.xs }}>
              {summary.completed} / {summary.total}
            </AppText>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: summary.percentage, text: `%${summary.percentage}` }}
            style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radii.pill, height: 9, marginTop: spacing.md, overflow: 'hidden' }}
          >
            <View style={{ backgroundColor: colors.primary, borderRadius: radii.pill, height: '100%', width: `${summary.percentage}%` }} />
          </View>
          <AppText color="muted" variant="caption" style={{ marginTop: spacing.sm }}>
            {summary.isEmpty ? 'Yeni bir görev ekleyerek planını oluşturabilirsin.' : `${summary.completed} görev tamamlandı, ${summary.total - summary.completed} görev kaldı.`}
          </AppText>
        </Card>

        <CampaignPlacement
          placement="preparation_inline_offer"
          context={createCampaignContext('preparation_inline_offer', {
            militaryCityId: profile?.militaryCity,
            militaryUnitId: profile?.militaryUnitId,
            forceCode: profile?.forceCode,
            militaryType: profile?.militaryType,
            conscriptionPeriodYear: profile?.militaryPeriodYear,
            conscriptionPeriodMonth: profile?.militaryPeriodMonth,
          })}
        />

        {!state?.longPressHintDismissed && !summary.isEmpty ? (
          <View style={{
            alignItems: 'center',
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radii.md,
            flexDirection: 'row',
            gap: spacing.sm,
            padding: spacing.md,
          }}>
            <Ionicons name="hand-left-outline" size={21} color={colors.primary} />
            <AppText color="muted" variant="caption" style={{ flex: 1 }}>
              Bir görevi düzenlemek veya silmek için üzerine basılı tutabilirsin.
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="İpucunu kapat" hitSlop={12} onPress={() => void dismissHint()}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {actionError ? (
          <InlineMessage message={actionError} destructive onDismiss={clearActionError} />
        ) : null}
        {notice ? <InlineMessage message={notice} onDismiss={() => setNotice(null)} /> : null}

        {summary.isEmpty ? (
          <Card>
            <EmptyState
              title="Hazırlık listen boş"
              description="Kendi planını oluşturabilir veya eksik varsayılan görevleri geri getirebilirsin."
              actionLabel="Görev ekle"
              onAction={() => setFormState({ mode: 'create', item: null })}
            />
            <Button
              label="Varsayılan listeyi geri yükle"
              variant="secondary"
              loading={restoring}
              onPress={confirmRestore}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {sections.map((category) => {
              const categoryItems = category.items;
              const categoryCompleted = categoryItems.filter((item) => item.completed).length;
              const collapsed = collapsedCategories.has(category.id);
              return (
                <View
                  key={category.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    overflow: 'hidden',
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${category.label}, ${categoryCompleted} / ${categoryItems.length} tamamlandı`}
                    accessibilityState={{ expanded: !collapsed }}
                    onPress={() => setCollapsedCategories((current) => {
                      const next = new Set(current);
                      if (next.has(category.id)) next.delete(category.id);
                      else next.add(category.id);
                      return next;
                    })}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
                      flexDirection: 'row',
                      gap: spacing.md,
                      minHeight: 64,
                      paddingHorizontal: spacing.md,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="subtitle" weight="800">{category.label}</AppText>
                      <AppText color="muted" variant="caption">{category.shortDescription}</AppText>
                    </View>
                    <AppText color="muted" weight="700">{categoryCompleted} / {categoryItems.length}</AppText>
                    <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color={colors.textMuted} />
                  </Pressable>
                  <CampaignPlacement
                    placement="preparation_category_offer"
                    context={createCampaignContext('preparation_category_offer', {
                      militaryCityId: profile?.militaryCity,
                      militaryUnitId: profile?.militaryUnitId,
                      forceCode: profile?.forceCode,
                      militaryType: profile?.militaryType,
                      conscriptionPeriodYear: profile?.militaryPeriodYear,
                      conscriptionPeriodMonth: profile?.militaryPeriodMonth,
                      preparationCategory: category.id,
                    })}
                  />
                  {!collapsed ? (
                    <View style={{ borderTopColor: colors.divider, borderTopWidth: 1 }}>
                      {categoryItems.map((item, index) => (
                        <View key={item.id} style={index > 0 ? { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth } : undefined}>
                          <PreparationItemRow
                            item={item}
                            actionsActive={actionsItemId === item.id}
                            onToggle={togglePreparationItem}
                            onOpenActions={openItemActions}
                            onEdit={editItemFromActions}
                            onDelete={requestDelete}
                            onCancelActions={closeItemActions}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {!summary.isEmpty ? (
          <View style={{ gap: spacing.sm }}>
            <Button label="Görev ekle" onPress={() => setFormState({ mode: 'create', item: null })} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Eksik varsayılan görevleri geri yükle"
              accessibilityState={{ busy: restoring }}
              disabled={restoring}
              onPress={confirmRestore}
              style={({ pressed }) => ({ alignItems: 'center', minHeight: 48, justifyContent: 'center', opacity: pressed || restoring ? 0.6 : 1 })}
            >
              <AppText color="muted" weight="600">{restoring ? 'Geri yükleniyor…' : 'Varsayılan listeyi geri yükle'}</AppText>
            </Pressable>
          </View>
        ) : null}
        </Pressable>
      </ScreenContainer>

      {formState ? (
        <PreparationItemFormModal
          visible
          mode={formState.mode}
          item={formState.item}
          onClose={() => setFormState(null)}
          onSubmit={submitForm}
        />
      ) : null}
      <DevremConfirmModal
        confirmLabel="Sil"
        description={deleteConfirmItem?.source === 'default'
          ? 'Bu varsayılan görev listenden kaldırılır. İstersen daha sonra eksik varsayılanları geri yükleyebilirsin.'
          : 'Bu görev hazırlık listenden kaldırılır.'}
        destructive
        onClose={() => setDeleteConfirmItem(null)}
        onConfirm={confirmDelete}
        title="Görev silinsin mi?"
        visible={deleteConfirmItem !== null}
      />
      <DevremConfirmModal
        confirmLabel="Geri yükle"
        description="Sildiğin varsayılan görevler yeniden eklenir. Kendi eklediğin ve düzenlediğin görevler silinmez."
        loading={restoring}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={() => { setRestoreConfirmOpen(false); void runRestore(); }}
        title="Eksik varsayılanlar geri yüklensin mi?"
        visible={restoreConfirmOpen}
      />
    </>
  );
}

function InlineMessage({
  message,
  destructive = false,
  onDismiss,
}: {
  message: string;
  destructive?: boolean;
  onDismiss: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: destructive ? colors.danger : colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
      }}
    >
      <AppText color={destructive ? 'danger' : 'muted'} variant="caption" style={{ flex: 1 }}>{message}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Mesajı kapat" hitSlop={12} onPress={onDismiss}>
        <Ionicons name="close" size={21} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
