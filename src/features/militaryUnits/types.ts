import type { ProvinceCode } from '@/data/turkeyProvinces';

export const forceCodes = ['land', 'air', 'navy', 'gendarmerie', 'coast_guard'] as const;
export type ForceCode = (typeof forceCodes)[number];

export interface MilitaryCoordinates {
  lat: number;
  lng: number;
}

export interface MilitaryUnitFacility {
  code: string;
  label: string;
  status: string;
  displayStatus: string;
  displayClaim: string | null;
  displayInApp: boolean;
  verifiedAt: string | null;
  source: unknown;
}

export interface MilitaryUnitInformationSource {
  authority: string;
  url: string;
}

export interface CanonicalMilitaryUnit {
  id: string;
  name: string;
  shortName: string | null;
  aliases: readonly string[];
  forceCode: ForceCode | null;
  forceName: string | null;
  cityCode: ProvinceCode;
  cityName: string;
  district: string | null;
  active: boolean;
  coordinates: MilitaryCoordinates | null;
  mapCoordinates: MilitaryCoordinates | null;
  coordinateStatus: string;
  publicAddress: string | null;
  publicAddressDisplayValue: string | null;
  publicAddressStatus: string;
  shortInfo: string | null;
  shortInfoStatus: string;
  transportation: string | null;
  transportationDisplayValue: string | null;
  transportationDisplayStatus: string;
  transportationStatus: string;
  transportationDisplayInApp: boolean;
  mapSearchQuery: string | null;
  mapCanOpenDirections: boolean;
  mapShowInApp: boolean;
  facilities: readonly MilitaryUnitFacility[];
  verificationStatus: string;
  verifiedAt: string | null;
  verificationSources: readonly MilitaryUnitInformationSource[];
  raw: Readonly<Record<string, unknown>>;
}

export interface ForceBranding {
  code: ForceCode;
  displayName: string;
  logoUrl: string | null;
  accentColor: string;
}

export type MilitaryUnitResolution =
  | { status: 'resolved'; unit: CanonicalMilitaryUnit }
  | { status: 'ambiguous'; candidates: readonly CanonicalMilitaryUnit[] }
  | { status: 'unresolved'; candidates: readonly [] };
