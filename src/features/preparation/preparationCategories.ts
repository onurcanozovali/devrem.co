import type { PreparationCategoryId } from './types/preparation';

export interface PreparationCategoryDefinition {
  id: PreparationCategoryId;
  label: string;
  shortDescription: string;
}

export const PREPARATION_CATEGORIES: readonly PreparationCategoryDefinition[] = [
  { id: 'official', label: 'Resmî İşlemler', shortDescription: 'Sevk ve katılış işlemleri' },
  { id: 'documents', label: 'Belgeler', shortDescription: 'Yanında bulunması gerekenler' },
  { id: 'travel', label: 'Yolculuk', shortDescription: 'Birliğe ulaşım planı' },
  { id: 'moneyCommunication', label: 'Para & İletişim', shortDescription: 'Bütçe ve iletişim hazırlığı' },
  { id: 'personal', label: 'Gitmeden Önce', shortDescription: 'Kişisel işleri tamamlama' },
  { id: 'bagEquipment', label: 'Çanta & Malzemeler', shortDescription: 'Önerilen temel ihtiyaçlar' },
] as const;

export const PREPARATION_CATEGORY_OPTIONS = PREPARATION_CATEGORIES.map(({ id, label }) => ({
  value: id,
  label,
}));

export const PREPARATION_CATEGORY_LABELS = Object.fromEntries(
  PREPARATION_CATEGORIES.map(({ id, label }) => [id, label]),
) as Record<PreparationCategoryId, string>;
