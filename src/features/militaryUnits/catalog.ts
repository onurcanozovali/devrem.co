import rawCatalog from '@/data/militaryUnits.v4.json';
import { isProvinceCode, type ProvinceCode } from '@/data/turkeyProvinces';
import { forceCodes, type CanonicalMilitaryUnit, type ForceCode, type MilitaryCoordinates, type MilitaryUnitFacility, type MilitaryUnitInformationSource, type MilitaryUnitResolution } from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readForceCode(value: unknown): ForceCode | null {
  return typeof value === 'string' && forceCodes.some((code) => code === value) ? value as ForceCode : null;
}

function readCoordinates(value: unknown): MilitaryCoordinates | null {
  if (!isRecord(value) || typeof value.lat !== 'number' || typeof value.lng !== 'number') return null;
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
  return { lat: value.lat, lng: value.lng };
}

function parseFacility(value: unknown): MilitaryUnitFacility | null {
  if (!isRecord(value)) return null;
  const code = readString(value.code);
  const label = readString(value.label);
  const status = readString(value.status);
  if (!code || !label || !status || typeof value.displayInApp !== 'boolean') return null;
  return {
    code,
    label,
    status,
    displayStatus: readString(value.displayStatus) ?? status,
    displayClaim: readString(value.displayClaim),
    displayInApp: value.displayInApp,
    verifiedAt: readString(value.verifiedAt),
    source: value.source ?? null,
  };
}

function parseInformationSource(value: unknown): MilitaryUnitInformationSource | null {
  if (!isRecord(value)) return null;
  const authority = readString(value.authority);
  const url = readString(value.url);
  if (!authority || !url || !/^https:\/\//i.test(url)) return null;
  return { authority, url };
}

function parseUnit(value: unknown): CanonicalMilitaryUnit {
  if (!isRecord(value)) throw new Error('Malformed military unit catalog record.');
  const force = isRecord(value.force) ? value.force : {};
  const city = isRecord(value.city) ? value.city : {};
  const guide = isRecord(value.guide) ? value.guide : {};
  const location = isRecord(value.location) ? value.location : {};
  const coordinateRecord = isRecord(location.coordinates) ? location.coordinates : {};
  const addressRecord = isRecord(location.publicAddress) ? location.publicAddress : {};
  const mapRecord = isRecord(location.map) ? location.map : {};
  const shortInfoRecord = isRecord(guide.shortInfo) ? guide.shortInfo : {};
  const transportationRecord = isRecord(guide.transportation) ? guide.transportation : {};
  const verification = isRecord(value.verification) ? value.verification : {};
  const appPresentation = isRecord(value.appPresentation) ? value.appPresentation : {};
  const id = readString(value.id);
  const name = readString(value.name);
  const cityName = readString(city.name);
  if (!id || !name || !cityName || !isProvinceCode(city.id)) {
    throw new Error(`Malformed canonical military unit: ${id ?? 'unknown'}`);
  }
  const coordinates = readCoordinates(coordinateRecord);
  return {
    id,
    name,
    shortName: readString(value.shortName),
    aliases: Array.isArray(value.aliases) ? value.aliases.flatMap((alias) => readString(alias) ?? []) : [],
    forceCode: readForceCode(force.code),
    forceName: readString(force.name),
    cityCode: city.id,
    cityName,
    district: readString(value.district),
    active: value.active === true,
    coordinates,
    mapCoordinates: coordinateRecord.displayOnMap === true ? coordinates : null,
    coordinateStatus: readString(coordinateRecord.status) ?? 'unknown',
    publicAddress: readString(addressRecord.value),
    publicAddressDisplayValue: readString(addressRecord.value) ?? readString(addressRecord.researchCandidate),
    publicAddressStatus: readString(addressRecord.status) ?? 'unknown',
    shortInfo: readString(shortInfoRecord.value),
    shortInfoStatus: readString(shortInfoRecord.status) ?? 'unknown',
    transportation: readString(transportationRecord.value),
    transportationDisplayValue: readString(transportationRecord.displayValue) ?? readString(transportationRecord.value),
    transportationDisplayStatus: readString(transportationRecord.displayStatus) ?? readString(transportationRecord.status) ?? 'unknown',
    transportationStatus: readString(transportationRecord.status) ?? 'unknown',
    transportationDisplayInApp: transportationRecord.displayInApp === true,
    mapSearchQuery: readString(mapRecord.searchQuery),
    mapCanOpenDirections: mapRecord.canOpenDirections === true,
    mapShowInApp: appPresentation.showMap !== false,
    facilities: Array.isArray(guide.facilities) ? guide.facilities.flatMap((facility) => parseFacility(facility) ?? []) : [],
    verificationStatus: readString(verification.status) ?? 'unknown',
    verifiedAt: readString(verification.verifiedAt),
    verificationSources: Array.isArray(verification.sources) ? verification.sources.flatMap((source) => parseInformationSource(source) ?? []) : [],
    raw: value,
  };
}

const catalogRecord: UnknownRecord = rawCatalog as unknown as UnknownRecord;
const parsedUnits = Array.isArray(catalogRecord.units) ? catalogRecord.units.map(parseUnit) : [];

if (parsedUnits.length === 0 || new Set(parsedUnits.map(({ id }) => id)).size !== parsedUnits.length) {
  throw new Error('Canonical military unit catalog is empty or contains duplicate IDs.');
}

export const militaryUnitCatalog = Object.freeze(parsedUnits);
export const militaryUnitCatalogMetadata = Object.freeze({
  catalogId: readString(catalogRecord.catalogId),
  generatedAt: readString(catalogRecord.generatedAt),
  schemaVersion: typeof catalogRecord.schemaVersion === 'number' ? catalogRecord.schemaVersion : null,
  dataQuality: isRecord(catalogRecord.dataQuality) ? catalogRecord.dataQuality : null,
});

const unitsById = new Map(militaryUnitCatalog.map((unit) => [unit.id, unit]));

export function normalizeMilitaryUnitSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMilitaryUnitById(id: string | null | undefined): CanonicalMilitaryUnit | null {
  return id ? unitsById.get(id) ?? null : null;
}

export function getMilitaryUnitsByCity(cityCode: ProvinceCode | null): readonly CanonicalMilitaryUnit[] {
  if (cityCode === null) return [];
  return militaryUnitCatalog.filter((unit) => unit.active && unit.cityCode === cityCode);
}

export function searchMilitaryUnits(cityCode: ProvinceCode | null, query: string): readonly CanonicalMilitaryUnit[] {
  const normalizedQuery = normalizeMilitaryUnitSearch(query);
  const units = getMilitaryUnitsByCity(cityCode);
  if (!normalizedQuery) return units;
  return units.filter((unit) => [unit.name, unit.shortName ?? '', ...unit.aliases]
    .some((candidate) => normalizeMilitaryUnitSearch(candidate).includes(normalizedQuery)));
}

export function resolveMilitaryUnit(cityCode: ProvinceCode, value: string): MilitaryUnitResolution {
  const target = normalizeMilitaryUnitSearch(value);
  if (!target) return { status: 'unresolved', candidates: [] };
  const candidates = getMilitaryUnitsByCity(cityCode).filter((unit) => [unit.name, unit.shortName ?? '', ...unit.aliases]
    .some((candidate) => normalizeMilitaryUnitSearch(candidate) === target));
  if (candidates.length === 1 && candidates[0]) return { status: 'resolved', unit: candidates[0] };
  if (candidates.length > 1) return { status: 'ambiguous', candidates };
  return { status: 'unresolved', candidates: [] };
}

export function isCanonicalUnitAssignment(cityCode: ProvinceCode, unitId: string, forceCode: ForceCode | null): boolean {
  const unit = getMilitaryUnitById(unitId);
  return Boolean(unit && unit.cityCode === cityCode && unit.forceCode === forceCode);
}
