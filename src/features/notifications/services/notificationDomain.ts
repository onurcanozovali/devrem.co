import type {
  NotificationPreferences,
  NotificationTarget,
} from '../types/notifications';

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: false,
  groupMessagesEnabled: true,
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
    groupMessagesEnabled: typeof value.groupMessagesEnabled === 'boolean'
      ? value.groupMessagesEnabled
      : true,
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
    data.type === 'direct_message'
    && data.target === 'directChat'
    && typeof data.conversationId === 'string'
    && /^direct-v1-[a-f0-9]{64}$/.test(data.conversationId)
    && typeof data.eventId === 'string'
    && data.eventId.trim().length > 0
  ) return { conversationId: data.conversationId, eventId: data.eventId, target: 'directChat' };
  if (
    data.type === 'group.message'
    && data.target === 'groupChat'
    && typeof data.groupId === 'string'
    && /^(devre|travel)-v1-[a-f0-9]{64}$/.test(data.groupId)
    && typeof data.eventId === 'string'
    && data.eventId.trim().length > 0
  ) {
    return { eventId: data.eventId, groupId: data.groupId, target: 'groupChat' };
  }
  if (
    data.type === 'testDiscovery'
    && data.target === 'matching'
    && typeof data.eventId === 'string'
    && data.eventId.trim().length > 0
  ) {
    return { eventId: data.eventId, target: 'matching' };
  }
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
    target: 'profile',
  };
}
