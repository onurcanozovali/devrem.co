export const profileFieldLimits = {
  nameMin: 2,
  nameMax: 50,
  militaryUnitMin: 2,
  militaryUnitMax: 120,
} as const;

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isValidName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = normalizeWhitespace(value);
  return normalized.length >= profileFieldLimits.nameMin && normalized.length <= profileFieldLimits.nameMax;
}

export function isValidBirthYear(value: unknown, currentYear = new Date().getFullYear()): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= currentYear - 100
    && value <= currentYear - 18;
}

export function isValidMilitaryPeriod(year: unknown, month: unknown): boolean {
  return typeof year === 'number' && Number.isInteger(year) && year >= 2020 && year <= 2100
    && typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12;
}

export function isValidMilitaryUnit(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = normalizeWhitespace(value);
  return normalized.length >= profileFieldLimits.militaryUnitMin
    && normalized.length <= profileFieldLimits.militaryUnitMax;
}

export function isValidOptionalMilitaryUnit(value: unknown): value is string | null {
  return value === null || isValidMilitaryUnit(value);
}

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isValidStoredDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function storedDateToLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !isValidStoredDate(value)) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function localDateToStoredDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatStoredDate(value: string): string {
  const date = storedDateToLocalDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function isMilitaryPeriodCurrentOrFuture(
  year: unknown,
  month: unknown,
  referenceDate = new Date(),
): boolean {
  if (
    typeof year !== 'number'
    || typeof month !== 'number'
    || !isValidMilitaryPeriod(year, month)
  ) return false;
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

export function getMinimumReportingDate(
  militaryPeriodYear: number,
  militaryPeriodMonth: number,
  referenceDate = new Date(),
): Date {
  const today = startOfLocalDay(referenceDate);
  const periodStart = new Date(militaryPeriodYear, militaryPeriodMonth - 1, 1);
  return periodStart > today ? periodStart : today;
}

export function isReportingDateConsistent(
  reportingDate: unknown,
  militaryPeriodYear: unknown,
  militaryPeriodMonth: unknown,
  referenceDate = new Date(),
): boolean {
  if (
    !isValidStoredDate(reportingDate)
    || typeof militaryPeriodYear !== 'number'
    || typeof militaryPeriodMonth !== 'number'
    || !isValidMilitaryPeriod(militaryPeriodYear, militaryPeriodMonth)
  ) return false;

  const selectedDate = storedDateToLocalDate(reportingDate);
  if (!selectedDate) return false;
  return selectedDate >= getMinimumReportingDate(
    militaryPeriodYear,
    militaryPeriodMonth,
    referenceDate,
  );
}

export function isReportingDateOnOrAfterPeriodStart(
  reportingDate: unknown,
  militaryPeriodYear: unknown,
  militaryPeriodMonth: unknown,
): boolean {
  if (
    !isValidStoredDate(reportingDate)
    || typeof militaryPeriodYear !== 'number'
    || typeof militaryPeriodMonth !== 'number'
    || !isValidMilitaryPeriod(militaryPeriodYear, militaryPeriodMonth)
  ) return false;

  const selectedDate = storedDateToLocalDate(reportingDate);
  if (!selectedDate) return false;
  return selectedDate >= new Date(militaryPeriodYear, militaryPeriodMonth - 1, 1);
}
