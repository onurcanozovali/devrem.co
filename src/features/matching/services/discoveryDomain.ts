import { getProvinceName, isProvinceCode } from '@/data/turkeyProvinces';
import { hasExactDevreIdentity } from '@devrem/devre-domain';
import { forceCodes, type ForceCode } from '@/features/militaryUnits/types';
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
  'lastName',
  'residenceCity',
  'departureCity',
  'militaryCity',
  'militaryPeriodYear',
  'militaryPeriodMonth',
  'militaryType',
  'militaryUnitId',
  'militaryUnitName',
  'forceCode',
  'photoPath',
  'updatedAt',
] as const;

const previousPublicProfileFields = publicProfileFields.filter((field) => field !== 'lastName');
const preForcePublicProfileFields = previousPublicProfileFields.filter((field) => field !== 'forceCode');

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

function isForceCode(value: unknown): value is ForceCode {
  return typeof value === 'string' && forceCodes.some((code) => code === value);
}

export function parsePublicProfileData(userId: string, value: unknown): PublicProfile | null {
  if (!userId || !isRecord(value)) return null;
  const isCurrentShape = hasOnlyFields(value, publicProfileFields);
  const isPreviousShape = hasOnlyFields(value, previousPublicProfileFields);
  const isPreForceShape = hasOnlyFields(value, preForcePublicProfileFields);
  const isLegacyShape = hasOnlyFields(value, legacyPublicProfileFields);
  if (!isCurrentShape && !isPreviousShape && !isPreForceShape && !isLegacyShape) return null;
  const hasCanonicalUnitShape = isCurrentShape || isPreviousShape || isPreForceShape;
  const militaryUnitId = hasCanonicalUnitShape ? value.militaryUnitId : null;
  const militaryUnitName = hasCanonicalUnitShape ? value.militaryUnitName : value.militaryUnit;
  const forceCode = isCurrentShape || isPreviousShape ? value.forceCode : null;
  const lastName = isCurrentShape && typeof value.lastName === 'string' ? normalizeWhitespace(value.lastName) : null;
  if (
    !isValidName(value.firstName)
    || !(lastName === null || isValidName(lastName))
    || !isProvinceCode(value.residenceCity)
    || !isProvinceCode(value.departureCity)
    || !isProvinceCode(value.militaryCity)
    || !isValidMilitaryPeriod(value.militaryPeriodYear, value.militaryPeriodMonth)
    || !isMilitaryType(value.militaryType)
    || !(militaryUnitId === null || (typeof militaryUnitId === 'string' && normalizeWhitespace(militaryUnitId).length > 0))
    || !isValidOptionalMilitaryUnit(militaryUnitName)
    || !(forceCode === null || isForceCode(forceCode))
    || !isValidProfilePhotoPath(userId, value.photoPath)
    || !(value.updatedAt instanceof Date)
  ) return null;

  return {
    userId,
    firstName: normalizeWhitespace(value.firstName),
    lastName,
    residenceCity: value.residenceCity,
    departureCity: value.departureCity,
    militaryCity: value.militaryCity,
    militaryPeriodYear: value.militaryPeriodYear as number,
    militaryPeriodMonth: value.militaryPeriodMonth as number,
    militaryType: value.militaryType,
    militaryUnitId: militaryUnitId === null ? null : normalizeWhitespace(militaryUnitId as string),
    militaryUnitName: militaryUnitName === null ? null : normalizeWhitespace(militaryUnitName as string),
    forceCode,
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
      const nameDifference = getPublicProfileDisplayName(left).localeCompare(getPublicProfileDisplayName(right), 'tr-TR');
      return nameDifference !== 0 ? nameDifference : left.userId.localeCompare(right.userId);
    });
}

export function getPublicProfileDisplayName(profile: Pick<PublicProfile, 'firstName' | 'lastName'>): string {
  return normalizeWhitespace([profile.firstName, profile.lastName ?? ''].filter(Boolean).join(' '));
}

export function matchesDiscoveryNameSearch(
  profile: Pick<PublicProfile, 'firstName' | 'lastName'>,
  searchText: string,
): boolean {
  const query = normalizeWhitespace(searchText).toLocaleLowerCase('tr-TR');
  return query.length === 0 || getPublicProfileDisplayName(profile).toLocaleLowerCase('tr-TR').includes(query);
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
