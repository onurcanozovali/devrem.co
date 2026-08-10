import type { PublicProfile } from '@/features/matching/types/discovery';
import type { MilitaryType } from '@/features/profile/types/profile';
import type { ProvinceCode } from '@/data/turkeyProvinces';

export interface DevreGroup {
  groupId: string;
  militaryCity: ProvinceCode;
  militaryPeriodMonth: number;
  militaryPeriodYear: number;
  militaryType: MilitaryType;
  militaryUnitId: string | null;
  militaryUnitName: string | null;
  members: PublicProfile[];
}

export type DevreGroupResult =
  | { status: 'pending'; group: null; acknowledged: false }
  | { status: 'ready'; group: DevreGroup; acknowledged: boolean };
