import { getProvinceName, isProvinceCode } from '@/data/turkeyProvinces';
import { hasExactDevreIdentity } from '@devrem/devre-domain';
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
  'militaryUnitId',
  'militaryUnitName',
  'photoPath',
  'updatedAt',
] as const;

const legacyPublicProfileFields = [
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

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const allowed = new Set<string>(fields);
  return Object.keys(value).length === fields.length
    && Object.keys(value).every((key) => allowed.has(key));
}

function isMilitaryType(value: unknown): value is MilitaryType {
  return typeof value === 'string' && militaryTypes.some((type) => type === value);
}

export function parsePublicProfileData(userId: string, value: unknown): PublicProfile | null {
  if (!userId || !isRecord(value)) return null;
  const isCurrentShape = hasOnlyFields(value, publicProfileFields);
  const isLegacyShape = hasOnlyFields(value, legacyPublicProfileFields);
  if (!isCurrentShape && !isLegacyShape) return null;
  const militaryUnitId = isCurrentShape ? value.militaryUnitId : null;
  const militaryUnitName = isCurrentShape ? value.militaryUnitName : value.militaryUnit;
  if (
    !isValidName(value.firstName)
    || !isProvinceCode(value.residenceCity)
    || !isProvinceCode(value.departureCity)
    || !isProvinceCode(value.militaryCity)
    || !isValidMilitaryPeriod(value.militaryPeriodYear, value.militaryPeriodMonth)
    || !isMilitaryType(value.militaryType)
    || !(militaryUnitId === null || (typeof militaryUnitId === 'string' && normalizeWhitespace(militaryUnitId).length > 0))
    || !isValidOptionalMilitaryUnit(militaryUnitName)
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
    militaryUnitId: militaryUnitId === null ? null : normalizeWhitespace(militaryUnitId as string),
    militaryUnitName: militaryUnitName === null ? null : normalizeWhitespace(militaryUnitName as string),
    photoPath: value.photoPath,
    updatedAt: value.updatedAt,
  };
}

export function hasExactDevreMatch(
  reference: DiscoveryReferenceProfile,
  candidate: PublicProfile,
): boolean {
  return hasExactDevreIdentity(reference, candidate);
}

export function getDiscoveryRelevanceScore(
  reference: DiscoveryReferenceProfile,
  candidate: PublicProfile,
): number {
  if (!hasExactDevreMatch(reference, candidate)) return -1;

  let score = 0;
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
      && hasExactDevreMatch(reference, candidate)
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
  const devreProfiles = profiles.filter((profile) => (
    profile.userId !== reference.userId
    && hasExactDevreMatch(reference, profile)
  ));
  if (segment === 'residence') {
    return devreProfiles.filter(({ residenceCity }) => residenceCity === reference.residenceCity);
  }
  if (segment === 'departure') {
    return devreProfiles.filter(({ departureCity }) => departureCity === reference.departureCity);
  }
  return devreProfiles;
}

export function getMatchReasonBadges(
  reference: DiscoveryReferenceProfile,
  candidate: PublicProfile,
): string[] {
  if (!hasExactDevreMatch(reference, candidate)) return [];
  const reasons: string[] = [];
  reasons.push('Aynı birlik');
  if (candidate.departureCity === reference.departureCity) {
    reasons.push(`${getProvinceName(candidate.departureCity)}'dan yola çıkıyor`);
  }
  if (candidate.residenceCity === reference.residenceCity) reasons.push('Aynı şehirden');
  return reasons.slice(0, 2);
}

export function getDiscoveryEmptyStateCopy(segment: DiscoverySegment): string {
  if (segment === 'residence') return 'Henüz senin şehrinden bir devre bulunamadı.';
  if (segment === 'departure') return 'Henüz seninle aynı yerden yola çıkacak bir devre yok.';
  return 'Henüz senin devre grubunda başka kimse yok.';
}
