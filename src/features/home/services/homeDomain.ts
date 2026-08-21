import { storedDateToLocalDate } from '@/features/profile/services/profileValidation';
import type { PreparationItem } from '@/features/preparation/types/preparation';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReportingCountdown =
  | { state: 'future'; daysRemaining: number }
  | { state: 'today'; daysRemaining: 0 }
  | { state: 'past'; daysRemaining: 0 }
  | { state: 'unavailable'; daysRemaining: null };

export function getTimeBasedGreeting(firstName: string, referenceDate = new Date()): string {
  const hour = referenceDate.getHours();
  const greeting = hour >= 5 && hour < 12
    ? 'Günaydın'
    : hour >= 12 && hour < 18
      ? 'Tünaydın'
      : hour >= 18 && hour < 22
        ? 'İyi akşamlar'
        : 'İyi geceler';
  return `${greeting}, ${firstName}`;
}

function localCalendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MILLISECONDS_PER_DAY;
}

export function getReportingCountdown(
  reportingDate: unknown,
  referenceDate = new Date(),
): ReportingCountdown {
  if (typeof reportingDate !== 'string') return { state: 'unavailable', daysRemaining: null };
  const reportingLocalDate = storedDateToLocalDate(reportingDate);
  if (!reportingLocalDate) return { state: 'unavailable', daysRemaining: null };

  const difference = localCalendarDayNumber(reportingLocalDate) - localCalendarDayNumber(referenceDate);
  if (difference > 0) return { state: 'future', daysRemaining: difference };
  if (difference === 0) return { state: 'today', daysRemaining: 0 };
  return { state: 'past', daysRemaining: 0 };
}

export function getImportantPreparationState(
  items: readonly PreparationItem[],
  visibleTaskLimit = 3,
) {
  const remainingItems = items.filter((item) => item.priority === 'important' && !item.completed);
  return {
    remainingCount: remainingItems.length,
    nextItems: remainingItems.slice(0, Math.max(0, visibleTaskLimit)),
  };
}
