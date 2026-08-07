import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';

import { mapAuthError } from '@/features/auth/services/authErrors';
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
