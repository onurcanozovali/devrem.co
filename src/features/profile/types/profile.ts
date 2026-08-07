import type { ProvinceCode } from '@/data/turkeyProvinces';

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
  reportingDate: string;
}

export interface UserProfile extends CompleteUserProfileInput {
  uid: string;
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
