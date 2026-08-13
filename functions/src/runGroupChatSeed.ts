import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

const developmentProjectId = 'devrem-d985b';
const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
const seedPrefix = 'dev-chat-seed-';

function readArgument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const action = process.argv[2];
const groupId = readArgument('--group');
const requestedCount = Number(readArgument('--count') ?? '10');

if (projectId !== developmentProjectId) {
  throw new Error(`Refusing to run unless GCLOUD_PROJECT is exactly ${developmentProjectId}.`);
}
if (action !== 'seed' && action !== 'clear') {
  throw new Error('Expected seed or clear action.');
}
if (!groupId || !/^devre-v1-[a-f0-9]{64}$/.test(groupId)) {
  throw new Error('Supply an exact Devre group with --group devre-v1-<64 hex characters>.');
}
if (action === 'seed' && requestedCount !== 10 && requestedCount !== 60) {
  throw new Error('--count must be either 10 or 60.');
}

const app = initializeApp({ projectId, credential: applicationDefault() });
const database = getFirestore(app);

async function clearSeedMessages(): Promise<number> {
  const snapshot = await database.collection(`devreGroups/${groupId}/messages`).limit(500).get();
  const references = snapshot.docs
    .filter((document) => document.id.startsWith(seedPrefix) && document.get('developmentSeed') === true)
    .map((document) => document.ref);
  for (let index = 0; index < references.length; index += 400) {
    const batch = database.batch();
    for (const reference of references.slice(index, index + 400)) batch.delete(reference);
    await batch.commit();
  }
  return references.length;
}

async function seedMessages(): Promise<number> {
  const [group, members] = await Promise.all([
    database.doc(`devreGroups/${groupId}`).get(),
    database.collection(`devreGroups/${groupId}/members`).limit(50).get(),
  ]);
  if (!group.exists) throw new Error('The explicitly supplied group does not exist.');
  if (members.empty) throw new Error('The explicitly supplied group has no members.');
  await clearSeedMessages();
  const senderUids = members.docs.map((document) => document.id);
  const now = Date.now();
  const batch = database.batch();
  for (let index = 0; index < requestedCount; index += 1) {
    const id = `${seedPrefix}${String(index + 1).padStart(3, '0')}`;
    const timestamp = Timestamp.fromMillis(now - (requestedCount - index) * 60_000);
    batch.set(database.doc(`devreGroups/${groupId}/messages/${id}`), {
      id,
      senderUid: senderUids[index % senderUids.length],
      type: 'text',
      text: index % 7 === 0
        ? `Geliştirme mesajı ${index + 1}\nÇok satırlı sohbet testi.`
        : `Geliştirme mesajı ${index + 1}`,
      createdAt: timestamp,
      clientCreatedAt: timestamp,
        replyToMessageId: null,
        schemaVersion: 4,
      developmentSeed: true,
    });
  }
  await batch.commit();
  return requestedCount;
}

(async () => {
  const count = action === 'clear' ? await clearSeedMessages() : await seedMessages();
  console.info(`${action === 'clear' ? 'Cleared' : 'Seeded'} ${count} development-only chat messages in ${groupId}.`);
  console.info('Development seed messages are ignored by the notification Function.');
})().catch((error: unknown) => {
  console.error(`Group chat ${action} failed.`, error);
  process.exitCode = 1;
}).finally(async () => {
  await deleteApp(app);
});
