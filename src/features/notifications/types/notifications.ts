export interface DiscoveryNotificationPreferences {
  newDevre: boolean;
  sameDepartureCity: boolean;
  sameResidenceCity: boolean;
}

export interface NotificationPreferences {
  discovery: DiscoveryNotificationPreferences;
  enabled: boolean;
}

export type NotificationPermissionState = 'authorized' | 'denied' | 'not-determined';

export type NotificationTarget = {
  eventId: string;
  profileUserId: string;
  target: 'profile';
} | {
  eventId: string;
  target: 'matching';
};
