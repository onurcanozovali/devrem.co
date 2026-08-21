import { getDevreIdentityKey, type DevreIdentityInput } from '@devrem/devre-domain';
import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';

import { createDirectConversationId } from './directMessages.js';

function serializeProfile(data: DocumentData): DocumentData {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    value instanceof Timestamp ? value.toDate().toISOString() : value,
  ]));
}

function identityInput(data: DocumentData | undefined): DevreIdentityInput | null {
  if (!data) return null;
  return {
    militaryCity: data.militaryCity,
    militaryPeriodMonth: data.militaryPeriodMonth,
    militaryPeriodYear: data.militaryPeriodYear,
    militaryType: data.militaryType,
    militaryUnitId: typeof data.militaryUnitId === 'string' ? data.militaryUnitId : null,
    militaryUnitName: typeof data.militaryUnitName === 'string' ? data.militaryUnitName
      : typeof data.militaryUnitNameSnapshot === 'string' ? data.militaryUnitNameSnapshot
        : typeof data.militaryUnit === 'string' ? data.militaryUnit : null,
  } as DevreIdentityInput;
}

export async function getAuthorizedPublicProfile(
  database: Firestore,
  callerUid: string,
  targetUid: string,
): Promise<DocumentData | null> {
  if (!targetUid || targetUid.length > 128) throw new Error('invalid-recipient');
  const targetReference = database.doc(`publicProfiles/${targetUid}`);
  const snapshots = await database.getAll(
    targetReference,
    database.doc(`users/${callerUid}`),
  );
  const target = snapshots[0];
  const caller = snapshots[1];
  if (!target || !caller) throw new Error('profile-read-failed');
  if (!target.exists) return null;
  if (callerUid === targetUid) return serializeProfile(target.data() ?? {});

  const callerIdentity = getDevreIdentityKey(identityInput(caller.data()));
  const targetIdentity = getDevreIdentityKey(identityInput(target.data()));
  if (callerIdentity && callerIdentity === targetIdentity) return serializeProfile(target.data() ?? {});

  const pointers = await database.getAll(
    database.doc(`_devreGroupMemberships/${callerUid}`),
    database.doc(`_travelGroupMemberships/${callerUid}`),
  );
  for (const pointer of pointers) {
    const groupId = pointer.get('groupId');
    if (typeof groupId !== 'string') continue;
    const members = await database.getAll(
      database.doc(`devreGroups/${groupId}/members/${callerUid}`),
      database.doc(`devreGroups/${groupId}/members/${targetUid}`),
    );
    const callerMember = members[0];
    const targetMember = members[1];
    if (!callerMember || !targetMember) throw new Error('profile-read-failed');
    if (callerMember.get('status') === 'active' && targetMember.exists) {
      return serializeProfile(target.data() ?? {});
    }
  }

  const directConversation = await database.doc(
    `directConversations/${createDirectConversationId(callerUid, targetUid)}`,
  ).get();
  const participants = directConversation.get('participantUids');
  if (directConversation.exists && Array.isArray(participants)
    && participants.includes(callerUid) && participants.includes(targetUid)) {
    return serializeProfile(target.data() ?? {});
  }
  throw new Error('profile-access-denied');
}
