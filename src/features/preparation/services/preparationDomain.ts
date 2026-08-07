import { PREPARATION_TEMPLATE } from '../preparationTemplate';
import { PREPARATION_CATEGORY_IDS } from '../types/preparation';
import type {
  PreparationCategoryId,
  PreparationItem,
  PreparationSummary,
  PreparationTemplateItem,
} from '../types/preparation';

export const PREPARATION_TITLE_MIN_LENGTH = 2;
export const PREPARATION_TITLE_MAX_LENGTH = 100;

export function isPreparationCategory(value: unknown): value is PreparationCategoryId {
  return typeof value === 'string' && PREPARATION_CATEGORY_IDS.includes(value as PreparationCategoryId);
}

export function normalizePreparationTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validatePreparationTitle(value: string): string | null {
  const normalized = normalizePreparationTitle(value);
  if (normalized.length < PREPARATION_TITLE_MIN_LENGTH) return 'Görev adı en az 2 karakter olmalı.';
  if (normalized.length > PREPARATION_TITLE_MAX_LENGTH) return 'Görev adı en fazla 100 karakter olabilir.';
  return null;
}

export function calculatePreparationSummary(items: readonly PreparationItem[]): PreparationSummary {
  const total = items.length;
  const completed = items.reduce((count, item) => count + (item.completed ? 1 : 0), 0);
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    isEmpty: total === 0,
  };
}

export function getNextPreparationSortOrder(
  items: readonly PreparationItem[],
  category: PreparationCategoryId,
): number {
  const maxSortOrder = items.reduce(
    (maximum, item) => item.category === category ? Math.max(maximum, item.sortOrder) : maximum,
    0,
  );
  return maxSortOrder + 100;
}

export function getTemplateItemsIntroducedAfter(version: number): readonly PreparationTemplateItem[] {
  return selectTemplateItemsIntroducedAfter(PREPARATION_TEMPLATE, version);
}

export function getMissingDefaultItems(existingItemIds: ReadonlySet<string>): readonly PreparationTemplateItem[] {
  return selectMissingDefaultItems(PREPARATION_TEMPLATE, existingItemIds);
}

export function selectTemplateItemsIntroducedAfter(
  template: readonly PreparationTemplateItem[],
  version: number,
): readonly PreparationTemplateItem[] {
  return template.filter((item) => item.introducedInVersion > version);
}

export function selectMissingDefaultItems(
  template: readonly PreparationTemplateItem[],
  existingItemIds: ReadonlySet<string>,
): readonly PreparationTemplateItem[] {
  return template.filter((item) => !existingItemIds.has(item.id));
}
