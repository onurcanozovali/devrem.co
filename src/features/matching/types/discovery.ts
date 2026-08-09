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
  militaryUnitId: string | null;
  militaryUnitName: string | null;
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
  militaryType: MilitaryType;
  militaryUnitId: string | null;
  militaryUnitName: string | null;
}

export type DiscoveryQuery = Pick<
  DiscoveryReferenceProfile,
  'militaryCity' | 'militaryPeriodMonth' | 'militaryPeriodYear' | 'militaryType' | 'militaryUnitId'
>;

export type DiscoverySegment = 'all' | 'residence' | 'departure';

export interface DiscoverySegmentOption {
  id: DiscoverySegment;
  label: string;
}