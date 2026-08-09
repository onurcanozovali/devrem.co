import { getProvinceName, isProvinceCode } from '@/data/turkeyProvinces';
import { isValidProfilePhotoPath } from '@/features/profile/services/profilePhotoDomain';
import {
  isValidMilitaryPeriod,
  isValidName,
  isValidOptionalMilitaryUnit,
  normalizeWhitespace,
} from '@/features/profile/services/profileValidation';
import { militaryTypes, type MilitaryType } from '@/features/profile/types/profile';
import type {
  DiscoveryReferenceProfile,
  DiscoverySegment,
  DiscoverySegmentOption,
  PublicProfile,
} from '../types/discovery';

const publicProfileFields = [
  'firstName',
  'residenceCity',
  'departureCity',
  'militaryCity',
  'militaryPeriodYear',
  'militaryPeriodMonth',
  'militaryType',
  'militaryUnit',
  'photoPath',
  'updatedAt',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyPublicProfileFields(value: Record<string, unknown>): boolean {
  const allowed = new Set<string>(publicProfileFields);
  return Object.keys(value).length === publicProfileFields.length
    && Object.keys(value).every((key) => allowed.has(key));
}

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
}

export function parsePublicProfileData(userId: string, value: unknown): PublicProfile | null {
  if (!userId || !isRecord(value) || !hasOnlyPublicProfileFields(value)) return null;
  if (
    !isValidName(value.firstName)
    || !isProvinceCode(value.residenceCity)
    || !isProvinceCode(value.departureCity)
    || !isProvinceCode(value.militaryCity)
    || !isValidMilitaryPeriod(value.militaryPeriodYear, value.militaryPeriodMonth)
    || !isMilitaryType(value.militaryType)
    || !isValidOptionalMilitaryUnit(value.militaryUnit)
    || !isValidProfilePhotoPath(userId, value.photoPath)
    || !(value.updatedAt instanceof Date)
  ) return null;

  return {
    userId,
    firstName: normalizeWhitespace(value.firstName),
    residenceCity: value.residenceCity,
    departureCity: value.departureCity,
    militaryCity: value.militaryCity,
    militaryPeriodYear: value.militaryPeriodYear as number,
    militaryPeriodMonth: value.militaryPeriodMonth as number,
    militaryType: value.militaryType,
    militaryUnit: value.militaryUnit === null ? null : normalizeWhitespace(value.militaryUnit),
    photoPath: value.photoPath,
    updatedAt: value.updatedAt,
  };
}

function normalizeMilitaryUnit(value: string | null): string | null {
  return value ? normalizeWhitespace(value).toLocaleLowerCase('tr-TR') : null;
}

export function getDiscoveryRelevanceScore(
  reference: DiscoveryReferenceProfile,
  candidate: PublicProfile,
): number {
  if (
    candidate.militaryPeriodYear !== reference.militaryPeriodYear
    || candidate.militaryPeriodMonth !== reference.militaryPeriodMonth
    || candidate.militaryCity !== reference.militaryCity
  ) return -1;

  let score = 0;
  const referenceUnit = normalizeMilitaryUnit(reference.militaryUnit);
  const candidateUnit = normalizeMilitaryUnit(candidate.militaryUnit);
  if (referenceUnit && candidateUnit && referenceUnit === candidateUnit) score += 100;
  if (candidate.departureCity === reference.departureCity) score += 60;
  if (candidate.residenceCity === reference.residenceCity) score += 30;
  return score;
}

export function filterAndRankPublicProfiles(
  candidates: PublicProfile[],
  reference: DiscoveryReferenceProfile,
): PublicProfile[] {
  return candidates
    .filter((candidate) => (
      candidate.userId !== reference.userId
      && candidate.militaryPeriodYear === reference.militaryPeriodYear
      && candidate.militaryPeriodMonth === reference.militaryPeriodMonth
      && candidate.militaryCity === reference.militaryCity
    ))
    .sort((left, right) => {
      const scoreDifference = getDiscoveryRelevanceScore(reference, right)
        - getDiscoveryRelevanceScore(reference, left);
      if (scoreDifference !== 0) return scoreDifference;
      const nameDifference = left.firstName.localeCompare(right.firstName, 'tr-TR');
      return nameDifference !== 0 ? nameDifference : left.userId.localeCompare(right.userId);
    });
}

export function getDiscoverySegmentOptions(
  reference: DiscoveryReferenceProfile,
): DiscoverySegmentOption[] {
  return [
    { id: 'all', label: 'Tümü' },
    { id: 'residence', label: 'Benim Şehrimden' },
    ...(reference.residenceCity === reference.departureCity
      ? []
      : [{ id: 'departure' as const, label: 'Benimle Yola Çıkanlar' }]),
  ];
}

export function filterPublicProfilesBySegment(
  profiles: PublicProfile[],
  reference: DiscoveryReferenceProfile,
  segment: DiscoverySegment,
): PublicProfile[] {
  if (segment === 'residence') {
    return profiles.filter(({ residenceCity }) => residenceCity === reference.residenceCity);
  }
  if (segment === 'departure') {
    return profiles.filter(({ departureCity }) => departureCity === reference.departureCity);
  }
  return profiles;
}

export function getMatchReasonBadges(
  reference: DiscoveryReferenceProfile,
  candidate: PublicProfile,
): string[] {
  const reasons: string[] = [];
  const referenceUnit = normalizeMilitaryUnit(reference.militaryUnit);
  const candidateUnit = normalizeMilitaryUnit(candidate.militaryUnit);
  if (referenceUnit && candidateUnit && referenceUnit === candidateUnit) reasons.push('Aynı birlik');
  if (candidate.departureCity === reference.departureCity) {
    reasons.push(`${getProvinceName(candidate.departureCity)}'dan yola çıkıyor`);
  }
  if (candidate.residenceCity === reference.residenceCity) reasons.push('Aynı şehirden');
  return reasons.slice(0, 2);
}

export function getDiscoveryEmptyStateCopy(segment: DiscoverySegment): string {
  if (segment === 'residence') return 'Henüz senin şehrinden bir devre bulunamadı.';
  if (segment === 'departure') return 'Henüz seninle aynı şehirden yola çıkacak biri yok.';
  return 'Henüz senin devre grubunda başka kimse yok.';
}