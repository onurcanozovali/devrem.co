let activeFingerprint: string | null = null;
let ownerUid: string | null = null;
const completedFingerprints = new Set<string>();

export function bindInboundShareToUser(fingerprint: string, uid: string): boolean {
  if (activeFingerprint !== fingerprint) {
    activeFingerprint = fingerprint;
    ownerUid = null;
  }
  if (ownerUid === null) ownerUid = uid;
  return ownerUid === uid;
}

export function beginInboundShareSend(fingerprint: string): boolean {
  if (completedFingerprints.has(fingerprint)) return false;
  completedFingerprints.add(fingerprint);
  if (completedFingerprints.size > 20) completedFingerprints.delete(completedFingerprints.values().next().value!);
  return true;
}

export function releaseInboundShareSend(fingerprint: string): void {
  completedFingerprints.delete(fingerprint);
}

export function clearInboundShareSession(fingerprint?: string): void {
  if (!fingerprint || activeFingerprint === fingerprint) {
    activeFingerprint = null;
    ownerUid = null;
  }
}
