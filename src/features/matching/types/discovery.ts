import type { ProvinceCode } from '@/data/turkeyProvinces';
import type { MilitaryType } from '@/features/profile/types/profile';

export interface PublicProfile {
  userId: string;
  firstName: string;
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
  departureCity: ProvinceCode;
  militaryCity: ProvinceCode;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryUnit: string | null;
}

export interface DiscoveryFilters {
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryCity: ProvinceCode | null;
  departureCity: ProvinceCode | null;
}