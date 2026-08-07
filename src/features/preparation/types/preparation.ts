export const PREPARATION_CATEGORY_IDS = [
  'official',
  'documents',
  'travel',
  'moneyCommunication',
  'personal',
  'bagEquipment',
] as const;

export type PreparationCategoryId = (typeof PREPARATION_CATEGORY_IDS)[number];
export type PreparationItemSource = 'default' | 'custom';
export type PreparationItemPriority = 'normal' | 'important';
export type PreparationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PreparationItem {
  id: string;
  title: string;
  category: PreparationCategoryId;
  completed: boolean;
  source: PreparationItemSource;
  sortOrder: number;
  priority: PreparationItemPriority;
  helper: string | null;
  templateKey: string | null;
  templateVersion: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
}

export interface PreparationItemInput {
  title: string;
  category: PreparationCategoryId;
}

export interface PreparationSummary {
  completed: number;
  total: number;
  percentage: number;
  isEmpty: boolean;
}

export interface PreparationState {
  templateVersion: number;
  longPressHintDismissed: boolean;
}

export interface PreparationTemplateItem {
  id: string;
  templateKey: string;
  introducedInVersion: number;
  title: string;
  category: PreparationCategoryId;
  sortOrder: number;
  priority: PreparationItemPriority;
  helper: string | null;
}
