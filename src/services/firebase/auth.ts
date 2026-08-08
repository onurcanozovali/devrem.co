import {
  PhoneAuthProvider,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithPhoneNumber,
  signOut,
  type ApplicationVerifier,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';

import { mapAuthError } from '@/features/auth/services/authErrors';
import { AccountDeletionError } from '@/features/auth/services/accountDeletionErrors';
import { getAppConfig } from '@/config/env';
import { getFirebaseApp } from './app';

function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function subscribeToAuthState(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), listener);
}

export async function requestPhoneVerification(phoneNumber: string): Promise<ConfirmationResult> {
  try {
    return await signInWithPhoneNumber(getFirebaseAuth(), phoneNumber);
  } catch (error: unknown) {
    throw mapAuthError(error);
  }
}

export async function confirmPhoneVerification(result: ConfirmationResult, code: string): Promise<void> {
  try {
    await result.confirm(code);
  } catch (error: unknown) {
    throw mapAuthError(error);
  }
}

export async function signOutCurrentUser(): Promise<void> {
  try {
    await signOut(getFirebaseAuth());
  } catch (error: unknown) {
    throw mapAuthError(error);
  }
}

function requireCurrentUser() {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AccountDeletionError('unauthenticated');
  return user;
}

function getAccountDeletionEndpoint(): string {
  const { projectId } = getAppConfig().firebase;
  return `https://europe-west1-${projectId}.cloudfunctions.net/deleteAccount`;
}

export function getCurrentUserPhoneNumber(): string | null {
  return getFirebaseAuth().currentUser?.phoneNumber ?? null;
}

export async function requestAccountDeletionReauthentication(): Promise<string> {
  const user = requireCurrentUser();
  if (!user.phoneNumber) throw new AccountDeletionError('unauthenticated');
  try {
    const provider = new PhoneAuthProvider(getFirebaseAuth());
    const nativeVerifier: ApplicationVerifier = {
      type: 'recaptcha',
      verify: async () => '',
    };
    return await provider.verifyPhoneNumber(user.phoneNumber, nativeVerifier);
  } catch (error: unknown) {
    throw mapAuthError(error);
  }
}

export async function confirmAccountDeletionReauthentication(
  verificationId: string,
  code: string,
): Promise<void> {
  const user = requireCurrentUser();
  try {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    await reauthenticateWithCredential(user, credential);
  } catch (error: unknown) {
    throw mapAuthError(error);
  }
}

export async function deleteCurrentAccount(): Promise<void> {
  const user = requireCurrentUser();
  let response: Response;
  try {
    const idToken = await getIdToken(user, true);
    response = await fetch(getAccountDeletionEndpoint(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    throw new AccountDeletionError('network');
  }

  if (!response.ok) {
    let code: unknown;
    try {
      code = (await response.json() as { code?: unknown }).code;
    } catch {
      code = null;
    }
    if (code === 'recent-auth-required') throw new AccountDeletionError('recent-auth-required');
    if (code === 'unauthenticated') throw new AccountDeletionError('unauthenticated');
    if (code === 'deletion-failed' || response.status >= 500) {
      throw new AccountDeletionError('unavailable');
    }
    throw new AccountDeletionError('unknown');
  }

  try {
    await signOut(getFirebaseAuth());
  } catch {
    throw new AccountDeletionError('session-clear-failed');
  }
}
