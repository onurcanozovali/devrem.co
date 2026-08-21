import {
  Timestamp,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import { LEGAL_VERSIONS } from '@/features/legal/legalConfig';
import { createCurrentLegalAcceptanceWrite, type LegalAcceptanceRecord } from '@/features/legal/legalDomain';
import { getFirebaseApp } from './app';

function getLegalAcceptanceReference(uid: string) {
  return doc(getFirestore(getFirebaseApp()), 'users', uid, 'legal', 'acceptance');
}

function readDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

export async function fetchLegalAcceptance(uid: string): Promise<LegalAcceptanceRecord | null> {
  const snapshot = await getDoc(getLegalAcceptanceReference(uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    termsAcceptedVersion: typeof data.termsAcceptedVersion === 'string' ? data.termsAcceptedVersion : '',
    termsAcceptedAt: readDate(data.termsAcceptedAt),
    privacyNoticeAcknowledgedVersion: typeof data.privacyNoticeAcknowledgedVersion === 'string'
      ? data.privacyNoticeAcknowledgedVersion
      : '',
    privacyNoticeAcknowledgedAt: readDate(data.privacyNoticeAcknowledgedAt),
  };
}

export async function recordCurrentLegalAcceptance(uid: string): Promise<void> {
  const database = getFirestore(getFirebaseApp());
  const reference = getLegalAcceptanceReference(uid);
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.exists() ? snapshot.data() : null;
    const termsCurrent = data?.termsAcceptedVersion === LEGAL_VERSIONS.terms
      && data.termsAcceptedAt instanceof Timestamp;
    const privacyCurrent = data?.privacyNoticeAcknowledgedVersion === LEGAL_VERSIONS.privacyNotice
      && data.privacyNoticeAcknowledgedAt instanceof Timestamp;
    if (termsCurrent && privacyCurrent) return;
    transaction.set(reference, createCurrentLegalAcceptanceWrite(serverTimestamp()));
  });
}
