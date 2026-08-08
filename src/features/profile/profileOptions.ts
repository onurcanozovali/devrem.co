import { turkeyProvinces } from '@/data/turkeyProvinces';
import type { MilitaryType } from './types/profile';

export const provinceOptions = turkeyProvinces.map(({ code, name }) => ({ value: code, label: name }));

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

const allMilitaryMonthOptions = monthLabels.map((label, index) => ({ value: index + 1, label }));

export function getMilitaryPeriodLabel(year: number, month: number): string {
  const monthLabel = monthLabels[month - 1];
  return monthLabel ? `${monthLabel} ${year}` : `${month}/${year}`;
}

export function createMilitaryYearOptions(referenceDate = new Date(), includeYear?: number) {
  const currentYear = referenceDate.getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => currentYear + index);
  if (includeYear !== undefined && !years.includes(includeYear)) years.push(includeYear);
  return years.sort((left, right) => left - right).map((year) => {
    return { value: year, label: String(year) };
  });
}

export function createMilitaryMonthOptions(
  year: number | null,
  referenceDate = new Date(),
  includePeriod?: { year: number; month: number },
) {
  if (year === null) return [];
  if (year < referenceDate.getFullYear()) {
    return includePeriod?.year === year
      ? allMilitaryMonthOptions.filter(({ value }) => value === includePeriod.month)
      : [];
  }
  if (year > referenceDate.getFullYear()) return allMilitaryMonthOptions;

  const currentMonth = referenceDate.getMonth() + 1;
  return allMilitaryMonthOptions.filter(({ value }) => (
    value >= currentMonth || (includePeriod?.year === year && includePeriod.month === value)
  ));
}
