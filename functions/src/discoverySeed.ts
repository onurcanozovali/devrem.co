import { deflateSync } from 'node:zlib';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import type { PublicProfileProjection } from './publicProfile.js';
import { synchronizePublicProfile } from './publicProfileSync.js';

interface SeedBucket {
  file(path: string): {
    save(data: Buffer, options: object): Promise<void>;
    delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
  };
}

export interface DiscoverySeedContext {
  currentUserId: string;
  residenceCity: number;
  departureCity: number;
  militaryCity: number;
  militaryPeriodYear: number;
  militaryPeriodMonth: number;
  militaryUnit: string;
}

interface DiscoverySeedProfile {
  id: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  hasAvatar: boolean;
  profile: PublicProfileProjection;
}

const markerPath = '_developmentSeeds/discovery';
const fakeIdPrefix = 'devrem-discovery-seed-';

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
    militaryUnit: null,
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
    create(`${fakeIdPrefix}a1`, 'A', 'Deneme Alp', { departureCity: context.departureCity, militaryUnit: context.militaryUnit }, true),
    create(`${fakeIdPrefix}a2`, 'A', 'Deneme Bora', { departureCity: context.departureCity, militaryUnit: context.militaryUnit }, true),
    create(`${fakeIdPrefix}a3`, 'A', 'Deneme Cem', { departureCity: context.departureCity, militaryUnit: context.militaryUnit }),
    create(`${fakeIdPrefix}b1`, 'B', 'Deneme Doruk', { departureCity: context.departureCity }, true),
    create(`${fakeIdPrefix}b2`, 'B', 'Deneme Efe', { departureCity: context.departureCity, militaryUnit: 'Farklı Deneme Birliği' }),
    create(`${fakeIdPrefix}c1`, 'C', 'Deneme Fırat', { residenceCity: context.residenceCity }, true),
    create(`${fakeIdPrefix}c2`, 'C', 'Deneme Gürkan', { residenceCity: context.residenceCity }),
    create(`${fakeIdPrefix}d1`, 'D', 'Deneme Hakan', {}),
    create(`${fakeIdPrefix}d2`, 'D', 'Deneme İlker', {}),
    create(`${fakeIdPrefix}e1`, 'E', 'Deneme Kaan', { militaryCity: otherDestination }),
    create(`${fakeIdPrefix}f1`, 'F', 'Deneme Levent', {
      militaryPeriodYear: differentPeriod.year,
      militaryPeriodMonth: differentPeriod.month,
    }),
    create(context.currentUserId, 'G', 'Deneme Kullanıcı', {
      residenceCity: context.residenceCity,
      departureCity: context.departureCity,
      militaryUnit: context.militaryUnit,
    }),
  ];
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
  if (markerSnapshot.exists && markerSnapshot.get('currentUserId') !== context.currentUserId) {
    throw new Error('Existing discovery seed belongs to a different current user. Clear it first.');
  }

  const fakeProfiles = profiles.filter(({ group }) => group !== 'G');
  if (!markerSnapshot.exists) {
    const snapshots = await database.getAll(...fakeProfiles.map(({ id }) => database.doc(`publicProfiles/${id}`)));
    if (snapshots.some(({ exists }) => exists)) {
      throw new Error('A deterministic discovery seed ID already exists. Refusing to overwrite it.');
    }
    await markerReference.create({
      currentUserId: context.currentUserId,
      seededIds: profiles.map(({ id }) => id),
      avatarIds: profiles.filter(({ hasAvatar }) => hasAvatar).map(({ id }) => id),
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

export async function clearDiscoveryProfiles(database: Firestore, bucket: SeedBucket): Promise<number> {
  const markerReference = database.doc(markerPath);
  const markerSnapshot = await markerReference.get();
  if (!markerSnapshot.exists) return 0;

  const seededIds = markerSnapshot.get('seededIds') as string[];
  const avatarIds = markerSnapshot.get('avatarIds') as string[];
  const currentUserId = markerSnapshot.get('currentUserId') as string;
  const batch = database.batch();
  for (const id of seededIds) {
    if (id !== currentUserId) batch.delete(database.doc(`publicProfiles/${id}`));
  }
  await batch.commit();
  await synchronizePublicProfile(database, currentUserId);
  await Promise.all(avatarIds.map((id) => (
    bucket.file(`users/${id}/profile/avatar.jpg`).delete({ ignoreNotFound: true })
  )));
  await markerReference.delete();
  return seededIds.length;
}