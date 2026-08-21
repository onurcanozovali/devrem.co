import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { createDevreGroupId, createTravelGroupId } from './devreGroups.js';
import type { PublicProfileProjection } from './publicProfile.js';

async function run(): Promise<void> {
const expectedProjectId = 'devrem-d985b';
const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (projectId !== expectedProjectId) throw new Error(`Refusing membership audit for project ${projectId ?? 'unknown'}.`);
if (!getApps().length) initializeApp({ projectId });
const database = getFirestore();

const [users, profiles, groups, devreStates, travelStates, memberships] = await Promise.all([
  database.collection('users').get(),
  database.collection('publicProfiles').get(),
  database.collection('devreGroups').get(),
  database.collection('_devreGroupMemberships').get(),
  database.collection('_travelGroupMemberships').get(),
  database.collectionGroup('members').get(),
]);
const profilesByUid = new Map(profiles.docs.map((document) => [document.id, document.data() as PublicProfileProjection]));
const activeByUid = new Map<string, string[]>();
let legacyMemberships = 0;
let leftMemberships = 0;
const membershipKeys = new Set<string>();
let duplicateMembershipDocuments = 0;
for (const membership of memberships.docs) {
  if (!membership.ref.parent.parent?.path.startsWith('devreGroups/')) continue;
  const key = `${membership.ref.parent.parent.id}\u0000${membership.id}`;
  if (membershipKeys.has(key)) duplicateMembershipDocuments += 1;
  membershipKeys.add(key);
  const status = membership.get('status');
  if (status === 'left') { leftMemberships += 1; continue; }
  if (status === undefined) legacyMemberships += 1;
  const current = activeByUid.get(membership.id) ?? [];
  current.push(membership.ref.parent.parent.id);
  activeByUid.set(membership.id, current);
}
const mismatchedDevrePointers = devreStates.docs.filter((state) => {
  const profile = profilesByUid.get(state.id);
  return !profile || state.get('groupId') !== createDevreGroupId(profile);
}).length;
const mismatchedTravelPointers = travelStates.docs.filter((state) => {
  const profile = profilesByUid.get(state.id);
  return !profile || state.get('groupId') !== createTravelGroupId(profile);
}).length;
const usersWithMultipleActiveDevreMemberships = [...activeByUid.values()].filter((ids) => ids.filter((id) => id.startsWith('devre-v1-')).length > 1).length;
const usersWithMultipleActiveTravelMemberships = [...activeByUid.values()].filter((ids) => ids.filter((id) => id.startsWith('travel-v1-')).length > 1).length;
const orphanActiveMemberships = [...activeByUid.entries()].filter(([uid]) => !profilesByUid.has(uid)).reduce((total, [, ids]) => total + ids.length, 0);

console.info(JSON.stringify({
  projectId,
  mode: 'read-only-dry-run',
  totalUserCount: users.size,
  publicProfileCount: profiles.size,
  totalDevreGroupCount: groups.size,
  totalMembershipDocumentCount: membershipKeys.size,
  devrePointerCount: devreStates.size,
  travelPointerCount: travelStates.size,
  activeMembershipCount: [...activeByUid.values()].reduce((total, ids) => total + ids.length, 0),
  legacyMembershipCount: legacyMemberships,
  leftMembershipCount: leftMemberships,
  usersWithMultipleActiveDevreMemberships,
  usersWithMultipleActiveTravelMemberships,
  mismatchedDevrePointers,
  mismatchedTravelPointers,
  orphanActiveMemberships,
  duplicateMembershipDocuments,
}, null, 2));
}

void run().catch((error: unknown) => {
  console.error('Membership audit failed.', error);
  process.exitCode = 1;
});
