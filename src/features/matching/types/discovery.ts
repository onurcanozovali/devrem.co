import type { ProvinceCode } from '@/data/turkeyProvinces';
import type { MilitaryType } from '@/features/profile/types/profile';

export interface PublicProfile {
  userId: string;
  firstName: string;
  residenceCity: ProvinceCode;
  departureCity: ProvinceCode;
  militaryCity: ProvinceCode;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryType: MilitaryType;
  militaryUnit: string | null;
  photoPath: string | null;
  updatedAt: Date;
}

export interface DiscoveryReferenceProfile {
  userId: string;
  residenceCity: ProvinceCode;
  departureCity: ProvinceCode;
  militaryCity: ProvinceCode;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryUnit: string | null;
}

export type DiscoverySegment = 'all' | 'residence' | 'departure';

export interface DiscoverySegmentOption {
  id: DiscoverySegment;
  label: string;
}