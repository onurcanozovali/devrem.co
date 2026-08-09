import { deflateSync } from 'node:zlib';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { createPublicProfileProjection, type PublicProfileProjection } from './publicProfile.js';

interface SeedBucket {
  file(path: string): {
    save(data: Buffer, options: object): Promise<void>;
    delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
    exists(): Promise<[boolean]>;
  };
}

export interface DiscoverySeedContext {
  residenceCity: number;
  departureCity: number;
  militaryCity: number;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryUnitName: string;
}

interface DiscoverySeedProfile {
  id: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  hasAvatar: boolean;
  profile: PublicProfileProjection;
}

const markerPath = '_developmentSeeds/discovery';
const fakeIdPrefix = 'devrem-discovery-seed-';
const fallbackContext: DiscoverySeedContext = {
  residenceCity: 34,
  departureCity: 6,
  militaryCity: 43,
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryUnitName: '1. Piyade Tugayı',
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function otherProvince(...excluded: number[]): number {
  for (let province = 1; province <= 81; province += 1) {
    if (!excluded.includes(province)) return province;
  }
  throw new Error('Unable to choose a seed province.');
}

function nextPeriod(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function buildDiscoverySeedProfiles(context: DiscoverySeedContext): DiscoverySeedProfile[] {
  const otherResidence = otherProvince(context.residenceCity, context.departureCity);
  const otherDeparture = otherProvince(context.departureCity, context.residenceCity, otherResidence);
  const otherDestination = otherProvince(context.militaryCity);
  const differentPeriod = nextPeriod(context.militaryPeriodYear, context.militaryPeriodMonth);
  const base = {
    residenceCity: otherResidence,
    departureCity: otherDeparture,
    militaryCity: context.militaryCity,
    militaryPeriodYear: context.militaryPeriodYear,
    militaryPeriodMonth: context.militaryPeriodMonth,
    militaryType: 'standard' as const,
    militaryUnitId: null,
    militaryUnitName: null,
    photoPath: null,
  };
  const create = (
    id: string,
    group: DiscoverySeedProfile['group'],
    firstName: string,
    overrides: Partial<PublicProfileProjection>,
    hasAvatar = false,
  ): DiscoverySeedProfile => ({
    id,
    group,
    hasAvatar,
    profile: {
      ...base,
      firstName,
      ...overrides,
      photoPath: hasAvatar ? `users/${id}/profile/avatar.jpg` : null,
    },
  });

  return [
    create(`${fakeIdPrefix}a1`, 'A', 'Deneme Alp', { departureCity: context.departureCity, militaryUnitName: context.militaryUnitName }, true),
    create(`${fakeIdPrefix}a2`, 'A', 'Deneme Bora', { departureCity: context.departureCity, militaryUnitName: context.militaryUnitName }, true),
    create(`${fakeIdPrefix}a3`, 'A', 'Deneme Cem', { departureCity: context.departureCity, militaryUnitName: context.militaryUnitName }),
    create(`${fakeIdPrefix}b1`, 'B', 'Deneme Doruk', { departureCity: context.departureCity, militaryUnitName: 'Farklı Deneme Birliği' }, true),
    create(`${fakeIdPrefix}b2`, 'B', 'Deneme Efe', { militaryUnitName: 'Başka Deneme Birliği' }),
    create(`${fakeIdPrefix}c1`, 'C', 'Deneme Fırat', { residenceCity: context.residenceCity, militaryUnitName: context.militaryUnitName }, true),
    create(`${fakeIdPrefix}c2`, 'C', 'Deneme Gürkan', { residenceCity: context.residenceCity, militaryUnitName: context.militaryUnitName }),
    create(`${fakeIdPrefix}d1`, 'D', 'Deneme Hakan', {}),
    create(`${fakeIdPrefix}d2`, 'D', 'Deneme İlker', {}),
    create(`${fakeIdPrefix}e1`, 'E', 'Deneme Kaan', { militaryCity: otherDestination, militaryUnitName: context.militaryUnitName }),
    create(`${fakeIdPrefix}f1`, 'F', 'Deneme Levent', {
      militaryPeriodYear: differentPeriod.year,
      militaryPeriodMonth: differentPeriod.month,
      militaryUnitName: context.militaryUnitName,
    }),
    create(`${fakeIdPrefix}g1`, 'G', 'Deneme Mert', { militaryType: 'paid', militaryUnitName: context.militaryUnitName }),
  ];
}

export async function resolveDiscoverySeedContext(database: Firestore): Promise<DiscoverySeedContext> {
  const snapshot = await database.collection('users').orderBy('updatedAt', 'desc').limit(20).get();
  for (const documentSnapshot of snapshot.docs) {
    const projection = createPublicProfileProjection(documentSnapshot.id, documentSnapshot.data());
    if (projection?.militaryUnitName) {
      return {
        residenceCity: projection.residenceCity,
        departureCity: projection.departureCity,
        militaryCity: projection.militaryCity,
        militaryPeriodYear: projection.militaryPeriodYear,
        militaryPeriodMonth: projection.militaryPeriodMonth,
        militaryUnitName: projection.militaryUnitName,
      };
    }
  }
  return fallbackContext;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createSeedAvatar(index: number): Buffer {
  const size = 64;
  const colors: readonly (readonly [number, number, number])[] = [
    [23, 107, 82],
    [38, 95, 156],
    [170, 74, 68],
    [126, 86, 42],
  ];
  const color = colors[index % colors.length] ?? colors[0]!;
  const rows: number[] = [];
  for (let y = 0; y < size; y += 1) {
    rows.push(0);
    for (let x = 0; x < size; x += 1) {
      const offset = Math.abs(x - y) < 8 ? 35 : 0;
      rows.push(
        Math.min(255, color[0] + offset),
        Math.min(255, color[1] + offset),
        Math.min(255, color[2] + offset),
      );
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function seedDiscoveryProfiles(
  database: Firestore,
  bucket: SeedBucket,
  context: DiscoverySeedContext,
): Promise<number> {
  const profiles = buildDiscoverySeedProfiles(context);
  const markerReference = database.doc(markerPath);
  const markerSnapshot = await markerReference.get();

  if (!markerSnapshot.exists) {
    const snapshots = await database.getAll(...profiles.map(({ id }) => database.doc(`publicProfiles/${id}`)));
    if (snapshots.some(({ exists }) => exists)) {
      throw new Error('A deterministic discovery seed ID already exists. Refusing to overwrite it.');
    }
    await markerReference.create({
      seededIds: profiles.map(({ id }) => id),
      avatarIds: profiles.filter(({ hasAvatar }) => hasAvatar).map(({ id }) => id),
      context,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const batch = database.batch();
  for (const { id, profile } of profiles) {
    batch.set(database.doc(`publicProfiles/${id}`), { ...profile, updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  await Promise.all(profiles.filter(({ hasAvatar }) => hasAvatar).map(({ id }, index) => (
    bucket.file(`users/${id}/profile/avatar.jpg`).save(createSeedAvatar(index), {
      contentType: 'image/png',
      metadata: { metadata: { devremDiscoverySeed: 'true' } },
      resumable: false,
    })
  )));
  return profiles.length;
}

export async function verifyDiscoveryProfiles(
  database: Firestore,
): Promise<{ id: string; firstName: string; photoPath: string | null }[]> {
  const markerSnapshot = await database.doc(markerPath).get();
  if (!markerSnapshot.exists) throw new Error('Discovery seed marker does not exist.');
  const seededIds = markerSnapshot.get('seededIds') as string[];
  const snapshots = await database.getAll(...seededIds.map((id) => database.doc(`publicProfiles/${id}`)));
  const verified = snapshots.flatMap((snapshot) => {
    if (!snapshot.exists) return [];
    const firstName = snapshot.get('firstName');
    const photoPath = snapshot.get('photoPath');
    return typeof firstName === 'string' && (typeof photoPath === 'string' || photoPath === null)
      ? [{ id: snapshot.id, firstName, photoPath }]
      : [];
  });
  if (seededIds.length !== 12 || verified.length !== 12) {
    throw new Error(`Expected 12 discovery profiles but verified ${verified.length}.`);
  }
  return verified;
}

export async function verifyDiscoveryQuery(database: Firestore): Promise<number> {
  const markerSnapshot = await database.doc(markerPath).get();
  if (!markerSnapshot.exists) throw new Error('Discovery seed marker does not exist.');
  const context = markerSnapshot.get('context') as DiscoverySeedContext;
  const seededIds = new Set(markerSnapshot.get('seededIds') as string[]);
  const snapshot = await database.collection('publicProfiles')
    .where('militaryPeriodYear', '==', context.militaryPeriodYear)
    .where('militaryPeriodMonth', '==', context.militaryPeriodMonth)
    .limit(40)
    .get();
  const candidateSeedCount = snapshot.docs.filter(({ id }) => seededIds.has(id)).length;
  if (candidateSeedCount !== 11) {
    throw new Error(`Expected the period query to return 11 seeded candidates but found ${candidateSeedCount}.`);
  }
  const temporaryUnitKey = normalizeWhitespace(context.militaryUnitName).toLocaleLowerCase('tr-TR');
  const exactDevreSeedCount = snapshot.docs.filter((documentSnapshot) => (
    seededIds.has(documentSnapshot.id)
    && documentSnapshot.get('militaryUnitId') === null
    && typeof documentSnapshot.get('militaryUnitName') === 'string'
    && normalizeWhitespace(documentSnapshot.get('militaryUnitName')).toLocaleLowerCase('tr-TR') === temporaryUnitKey
  )).length;
  if (exactDevreSeedCount !== 7) {
    throw new Error(`Expected exact-unit filtering to retain 7 seeded devre profiles but found ${exactDevreSeedCount}.`);
  }
  return candidateSeedCount;
}

export async function clearDiscoveryProfiles(database: Firestore, bucket: SeedBucket): Promise<number> {
  const markerReference = database.doc(markerPath);
  const markerSnapshot = await markerReference.get();
  if (!markerSnapshot.exists) return 0;

  const seededIds = markerSnapshot.get('seededIds') as string[];
  const avatarIds = markerSnapshot.get('avatarIds') as string[];
  const batch = database.batch();
  for (const id of seededIds) batch.delete(database.doc(`publicProfiles/${id}`));
  await batch.commit();
  await Promise.all(avatarIds.map((id) => (
    bucket.file(`users/${id}/profile/avatar.jpg`).delete({ ignoreNotFound: true })
  )));
  await markerReference.delete();
  return seededIds.length;
}