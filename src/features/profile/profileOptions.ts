import type { MilitaryType } from './types/profile';

export const militaryTypeLabels: Record<MilitaryType, string> = {
  standard: 'Er / Erbaş',
  paid: 'Bedelli',
  reserveOfficer: 'Yedek Subay',
  reserveNco: 'Yedek Astsubay',
};

export const militaryTypeOptions = Object.entries(militaryTypeLabels).map(([value, label]) => ({
  value: value as MilitaryType,
  label,
}));

export const monthLabels = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export const militaryMonthOptions = monthLabels.map((label, index) => ({ value: index + 1, label }));

export function getMilitaryPeriodLabel(year: number, month: number): string {
  const monthLabel = monthLabels[month - 1];
  return monthLabel ? `${monthLabel} ${year}` : `${month}/${year}`;
}

export function createMilitaryYearOptions(currentYear = new Date().getFullYear()) {
  return Array.from({ length: 6 }, (_, index) => {
    const year = currentYear + index;
    return { value: year, label: String(year) };
  });
}
