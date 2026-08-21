import type { PublicProfile } from '@/features/matching/types/discovery';
import type { MilitaryType } from '@/features/profile/types/profile';
import type { ProvinceCode } from '@/data/turkeyProvinces';
import type { ForceCode } from '@/features/militaryUnits/types';

export interface DevreGroupSummary {
  groupId: string;
  kind: 'devre' | 'travel';
  departureCity: ProvinceCode | null;
  militaryCity: ProvinceCode;
  militaryPeriodMonth: number;
  militaryPeriodYear: number;
  militaryType: MilitaryType;
  militaryUnitId: string | null;
  militaryUnitName: string | null;
  forceCode: ForceCode | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageType: 'text' | 'image' | 'audio' | 'document' | null;
}

export interface DevreGroup extends DevreGroupSummary {
  members: PublicProfile[];
  departedMembers: PublicProfile[];
  membershipStatusByUid: Readonly<Record<string, 'active' | 'left'>>;
}

export type DevreGroupResult =
  | { status: 'pending'; group: null; acknowledged: false }
  | { status: 'ready'; group: DevreGroupSummary; acknowledged: boolean };
