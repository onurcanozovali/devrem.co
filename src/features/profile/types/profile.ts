import type { ProvinceCode } from '@/data/turkeyProvinces';
import type { ForceCode } from '@/features/militaryUnits/types';

export const militaryTypes = ['standard', 'paid', 'reserveOfficer', 'reserveNco'] as const;

export type MilitaryType = (typeof militaryTypes)[number];

export interface CompleteUserProfileInput {
  firstName: string;
  lastName: string;
  birthYear: number;
  residenceCity: ProvinceCode;
  departureCity: ProvinceCode;
  militaryCity: ProvinceCode;
  militaryType: MilitaryType;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryUnit: string | null;
  militaryUnitId?: string | null;
  militaryUnitNameSnapshot?: string | null;
  forceCode?: ForceCode | null;
  reportingDate: string;
}

export interface UserProfile
  extends Omit<
    CompleteUserProfileInput,
    'militaryUnitId' | 'militaryUnitNameSnapshot' | 'forceCode'
  > {
  uid: string;
  militaryUnitId: string | null;
  militaryUnitNameSnapshot: string | null;
  forceCode: ForceCode | null;
  photoPath: string | null;
  onboardingCompleted: true;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type UserProfileSnapshot =
  | { status: 'missing'; profile: null }
  | { status: 'incomplete'; profile: null }
  | { status: 'complete'; profile: UserProfile };

export type ProfileStatus = 'idle' | 'loading' | 'missing' | 'incomplete' | 'complete' | 'error';

export type ProfileErrorCode = 'network' | 'permission-denied' | 'unavailable' | 'malformed' | 'unknown';
