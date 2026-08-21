import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getDevreIdentityKey } from '@devrem/devre-domain';

const allowedProjectId = 'devrem-d985b';

interface CatalogUnit {
  id: string;
  name: string;
  aliases: string[];
  shortName: string | null;
  cityCode: number;
  forceCode: string | null;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9çğıöşü]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function loadCatalog(): Promise<CatalogUnit[]> {
  const catalogPath = path.resolve(process.cwd(), '..', 'src', 'data', 'militaryUnits.v4.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as { units?: unknown[] };
  if (!Array.isArray(catalog.units)) throw new Error('Canonical military unit catalog is missing.');
  return catalog.units.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return [];
    const unit = value as Record<string, unknown>;
    const city = typeof unit.city === 'object' && unit.city !== null ? unit.city as Record<string, unknown> : {};
    const force = typeof unit.force === 'object' && unit.force !== null ? unit.force as Record<string, unknown> : {};
    if (typeof unit.id !== 'string' || typeof unit.name !== 'string' || typeof city.id !== 'number') return [];
    return [{
      id: unit.id,
      name: unit.name,
      aliases: Array.isArray(unit.aliases) ? unit.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
      shortName: typeof unit.shortName === 'string' ? unit.shortName : null,
      cityCode: city.id,
      forceCode: typeof force.code === 'string' ? force.code : null,
    }];
  });
}

async function run() {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
  if (projectId !== allowedProjectId) throw new Error(`Refusing to run: projectId must equal ${allowedProjectId}.`);
  const apply = process.argv.includes('--apply');
  const units = await loadCatalog();
  const database = getFirestore();
  const snapshot = await database.collection('users').get();
  let resolved = 0;
  let ambiguous = 0;
  let unresolved = 0;
  let skipped = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (typeof data.militaryUnitId === 'string' && data.militaryUnitId.trim()) { skipped += 1; continue; }
    if (typeof data.militaryCity !== 'number' || typeof data.militaryUnit !== 'string') { skipped += 1; continue; }
    const target = normalize(data.militaryUnit);
    const matches = units.filter((unit) => unit.cityCode === data.militaryCity && [unit.name, unit.shortName ?? '', ...unit.aliases].some((candidate) => normalize(candidate) === target));
    if (matches.length === 1 && matches[0]) {
      const match = matches[0];
      const canonicalFingerprint = getDevreIdentityKey({
        militaryCity: data.militaryCity,
        militaryPeriodMonth: data.militaryPeriodMonth,
        militaryPeriodYear: data.militaryPeriodYear,
        militaryType: data.militaryType,
        militaryUnitId: match.id,
        militaryUnitName: match.name,
      });
      if (!canonicalFingerprint || data.onboardingCompleted !== true) {
        skipped += 1;
        console.info(`[skipped-invalid-profile] uid=${document.id}`);
        continue;
      }
      resolved += 1;
      if (apply) {
        const notificationReference = database.doc(`_notificationMemberships/${document.id}`);
        await database.runTransaction(async (transaction) => {
          const notificationSnapshot = await transaction.get(notificationReference);
          const notificationData = notificationSnapshot.data();
          const version = typeof notificationData?.version === 'number'
            && Number.isInteger(notificationData.version)
            && notificationData.version >= 0
            ? notificationData.version
            : 1;
          transaction.update(document.ref, {
            militaryUnitId: match.id,
            militaryUnitNameSnapshot: match.name,
            forceCode: match.forceCode,
          });
          transaction.set(notificationReference, {
            uid: document.id,
            active: true,
            fingerprint: canonicalFingerprint,
            lastJoinEventId: typeof notificationData?.lastJoinEventId === 'string'
              ? notificationData.lastJoinEventId
              : null,
            version,
            ...(notificationSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        });
      }
    } else if (matches.length > 1) {
      ambiguous += 1;
      console.info(`[ambiguous] uid=${document.id} candidates=${matches.map(({ id }) => id).join(',')}`);
    } else {
      unresolved += 1;
      console.info(`[unresolved] uid=${document.id}`);
    }
  }
  console.info(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: snapshot.size, resolved, ambiguous, unresolved, skipped }));
}

initializeApp();
void run().catch((error: unknown) => {
  console.error('Military unit backfill failed.', error);
  process.exitCode = 1;
});
