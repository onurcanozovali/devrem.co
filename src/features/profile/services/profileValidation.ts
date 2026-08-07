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
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= currentYear - 18;
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

export function formatReportingDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');
}

export function parseReportingDateInput(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return `${yearText}-${monthText}-${dayText}`;
}

export function isValidStoredDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  return parseReportingDateInput(`${match[3]}.${match[2]}.${match[1]}`) === value;
}

export function formatStoredDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}
