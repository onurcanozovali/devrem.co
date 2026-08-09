import { isProvinceCode } from '@/data/turkeyProvinces';
import { isValidProfilePhotoPath } from '@/features/profile/services/profilePhotoDomain';
import {
  isMilitaryPeriodCurrentOrFuture,
  isValidMilitaryPeriod,
  isValidName,
  isValidOptionalMilitaryUnit,
  normalizeWhitespace,
} from '@/features/profile/services/profileValidation';
import { militaryTypes, type MilitaryType } from '@/features/profile/types/profile';
import type {
  DiscoveryFilters,
  DiscoveryReferenceProfile,
  PublicProfile,
} from '../types/discovery';

const publicProfileFields = [
  'firstName',
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
  ) return -1;

  let score = 0;
  if (candidate.militaryCity === reference.militaryCity) score += 100;
  const referenceUnit = normalizeMilitaryUnit(reference.militaryUnit);
  const candidateUnit = normalizeMilitaryUnit(candidate.militaryUnit);
  if (referenceUnit && candidateUnit && referenceUnit === candidateUnit) score += 60;
  if (candidate.departureCity === reference.departureCity) score += 30;
  return score;
}

export function filterAndRankPublicProfiles(
  candidates: PublicProfile[],
  reference: DiscoveryReferenceProfile,
  filters: DiscoveryFilters,
): PublicProfile[] {
  const relevanceReference = {
    ...reference,
    militaryPeriodYear: filters.militaryPeriodYear,
    militaryPeriodMonth: filters.militaryPeriodMonth,
  };
  return candidates
    .filter((candidate) => (
      candidate.userId !== reference.userId
      && candidate.militaryPeriodYear === filters.militaryPeriodYear
      && candidate.militaryPeriodMonth === filters.militaryPeriodMonth
      && (filters.militaryCity === null || candidate.militaryCity === filters.militaryCity)
      && (filters.departureCity === null || candidate.departureCity === filters.departureCity)
    ))
    .sort((left, right) => {
      const scoreDifference = getDiscoveryRelevanceScore(relevanceReference, right)
        - getDiscoveryRelevanceScore(relevanceReference, left);
      if (scoreDifference !== 0) return scoreDifference;
      const nameDifference = left.firstName.localeCompare(right.firstName, 'tr-TR');
      return nameDifference !== 0 ? nameDifference : left.userId.localeCompare(right.userId);
    });
}

export function isDiscoveryPeriodSelectable(
  year: number,
  month: number,
  profilePeriod: { year: number; month: number },
  referenceDate = new Date(),
): boolean {
  return isMilitaryPeriodCurrentOrFuture(year, month, referenceDate)
    || (year === profilePeriod.year && month === profilePeriod.month);
}