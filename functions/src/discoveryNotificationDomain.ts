import type { PublicProfileProjection } from './publicProfile.js';

export const discoveryNotificationDailyLimit = 3;

export type DiscoveryNotificationReason =
  | 'sameDepartureCity'
  | 'sameResidenceCity'
  | 'newDevre';

export interface DiscoveryNotificationPreferences {
  newDevre: boolean;
  sameResidenceCity: boolean;
  sameDepartureCity: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  discovery: DiscoveryNotificationPreferences;
}

export interface NotificationProfile extends PublicProfileProjection {
  userId: string;
}

export interface MembershipState {
  active: boolean;
  fingerprint: string | null;
  lastJoinEventId: string | null;
  version: number;
}

export type MembershipTransitionSource = 'live' | 'baseline' | 'development-seed';

export interface MembershipTransition {
  nextState: MembershipState;
  shouldNotify: boolean;
}

export type DeliveryReservationDecision = 'duplicate' | 'rate-limited' | 'send';

const militaryTypes = ['standard', 'paid', 'reserveOfficer', 'reserveNco'] as const;

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeTemporaryUnitName(value: string | null): string | null {
  return value ? normalizeWhitespace(value).toLocaleLowerCase('tr-TR') : null;
}

function hasValidMilitaryType(value: unknown): boolean {
  return typeof value === 'string' && militaryTypes.some((militaryType) => militaryType === value);
}

export function hasExactDevreIdentity(
  reference: NotificationProfile,
  candidate: NotificationProfile,
): boolean {
  if (
    !hasValidMilitaryType(reference.militaryType)
    || !hasValidMilitaryType(candidate.militaryType)
    || reference.militaryPeriodYear !== candidate.militaryPeriodYear
    || reference.militaryPeriodMonth !== candidate.militaryPeriodMonth
    || reference.militaryCity !== candidate.militaryCity
    || reference.militaryType !== candidate.militaryType
  ) return false;

  if (reference.militaryUnitId !== null || candidate.militaryUnitId !== null) {
    return reference.militaryUnitId !== null
      && candidate.militaryUnitId !== null
      && reference.militaryUnitId === candidate.militaryUnitId;
  }

  const referenceUnit = normalizeTemporaryUnitName(reference.militaryUnitName);
  const candidateUnit = normalizeTemporaryUnitName(candidate.militaryUnitName);
  return referenceUnit !== null && candidateUnit !== null && referenceUnit === candidateUnit;
}

export function getDiscoveryNotificationReason(
  joiningProfile: NotificationProfile,
  recipientProfile: NotificationProfile,
  preferences: NotificationPreferences,
): DiscoveryNotificationReason | null {
  if (!preferences.enabled || !hasExactDevreIdentity(joiningProfile, recipientProfile)) return null;
  if (
    joiningProfile.departureCity === recipientProfile.departureCity
    && preferences.discovery.sameDepartureCity
  ) return 'sameDepartureCity';
  if (
    joiningProfile.residenceCity === recipientProfile.residenceCity
    && preferences.discovery.sameResidenceCity
  ) return 'sameResidenceCity';
  return preferences.discovery.newDevre ? 'newDevre' : null;
}

export function getMembershipFingerprint(profile: PublicProfileProjection | null): string | null {
  if (!profile || !hasValidMilitaryType(profile.militaryType)) return null;
  const normalizedUnitName = normalizeTemporaryUnitName(profile.militaryUnitName);
  const unitIdentity = profile.militaryUnitId
    ? `id:${normalizeWhitespace(profile.militaryUnitId)}`
    : normalizedUnitName ? `name:${normalizedUnitName}` : null;
  if (!unitIdentity) return null;
  return JSON.stringify([
    profile.militaryPeriodYear,
    profile.militaryPeriodMonth,
    profile.militaryCity,
    profile.militaryType,
    unitIdentity,
  ]);
}

export function decideMembershipTransition(input: {
  beforeFingerprint: string | null;
  nextFingerprint: string | null;
  previousState: MembershipState | null;
  notificationsEnabled: boolean;
  sourceEventId: string | null;
  source: MembershipTransitionSource;
}): MembershipTransition {
  const {
    beforeFingerprint,
    nextFingerprint,
    previousState,
    notificationsEnabled,
    source,
    sourceEventId,
  } = input;
  if (nextFingerprint === null) {
    return {
      nextState: {
        active: false,
        fingerprint: null,
        lastJoinEventId: previousState?.lastJoinEventId ?? null,
        version: previousState?.version ?? 0,
      },
      shouldNotify: false,
    };
  }

  const isInitialState = previousState === null;
  const enteredNewMembership = isInitialState
    ? beforeFingerprint === null
    : !previousState.active || previousState.fingerprint !== nextFingerprint;
  const retriesNotifiedJoin = source === 'live'
    && sourceEventId !== null
    && previousState?.active === true
    && previousState.fingerprint === nextFingerprint
    && previousState.lastJoinEventId === sourceEventId;
  const nextVersion = previousState === null
    ? 1
    : enteredNewMembership
      ? previousState.version + 1
      : previousState.version;
  const shouldNotify = notificationsEnabled
    && source === 'live'
    && (enteredNewMembership || retriesNotifiedJoin);
  return {
    nextState: {
      active: true,
      fingerprint: nextFingerprint,
      lastJoinEventId: enteredNewMembership && shouldNotify
        ? sourceEventId
        : previousState?.lastJoinEventId ?? null,
      version: nextVersion,
    },
    shouldNotify,
  };
}

export function getDeliveryReservationDecision(input: {
  currentDailyCount: number;
  deliveryAlreadyExists: boolean;
}): DeliveryReservationDecision {
  if (input.deliveryAlreadyExists) return 'duplicate';
  return input.currentDailyCount >= discoveryNotificationDailyLimit ? 'rate-limited' : 'send';
}

export function getUtcDayBucket(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export function createDiscoveryNotificationCopy(
  reason: DiscoveryNotificationReason,
  firstName: string,
): { title: string; body: string } {
  const safeFirstName = normalizeWhitespace(firstName);
  if (reason === 'sameDepartureCity') {
    return {
      title: 'Yol arkadaşın olabilir 🚌',
      body: `${safeFirstName} de seninle aynı yerden yola çıkacak. Hemen keşfet.`,
    };
  }
  if (reason === 'sameResidenceCity') {
    return {
      title: 'Şehrinden yeni bir devren var 👋',
      body: `${safeFirstName} de senin şehrinden.`,
    };
  }
  return {
    title: 'Yeni bir devren geldi 👋',
    body: 'Seninle aynı birliğe gidecek yeni bir devren katıldı. Hemen tanış.',
  };
}