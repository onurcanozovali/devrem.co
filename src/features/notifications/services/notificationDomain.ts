import type {
  NotificationPreferences,
  NotificationTarget,
} from '../types/notifications';

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: false,
  discovery: {
    newDevre: true,
    sameResidenceCity: true,
    sameDepartureCity: true,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !isRecord(value.discovery)) return null;
  if (
    typeof value.discovery.newDevre !== 'boolean'
    || typeof value.discovery.sameResidenceCity !== 'boolean'
    || typeof value.discovery.sameDepartureCity !== 'boolean'
  ) return null;
  return {
    enabled: value.enabled,
    discovery: {
      newDevre: value.discovery.newDevre,
      sameResidenceCity: value.discovery.sameResidenceCity,
      sameDepartureCity: value.discovery.sameDepartureCity,
    },
  };
}

export function parseNotificationTarget(data: unknown): NotificationTarget | null {
  if (!isRecord(data)) return null;
  if (
    data.type !== 'discovery.newDevre'
    || data.target !== 'profile'
    || typeof data.profileUserId !== 'string'
    || data.profileUserId.trim().length === 0
    || typeof data.eventId !== 'string'
    || data.eventId.trim().length === 0
  ) return null;
  return {
    eventId: data.eventId,
    profileUserId: data.profileUserId,
  };
}