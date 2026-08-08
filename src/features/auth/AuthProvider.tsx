import type { ConfirmationResult } from '@react-native-firebase/auth';
import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  confirmAccountDeletionReauthentication,
  confirmPhoneVerification,
  deleteCurrentAccount,
  getCurrentUserPhoneNumber,
  requestAccountDeletionReauthentication,
  requestPhoneVerification,
  signOutCurrentUser,
  subscribeToAuthState,
} from '@/services/firebase';
import { AuthFlowError, mapAuthError } from './services/authErrors';
import type { AuthSession, AuthStatus } from './types/auth';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  pendingPhoneNumber: string | null;
  initializationError: string | null;
  sendVerificationCode: (phoneNumber: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  clearVerification: () => void;
  logout: () => Promise<void>;
  accountPhoneNumber: string | null;
  deleteAccount: () => Promise<void>;
  sendAccountDeletionCode: () => Promise<void>;
  confirmAccountDeletionCode: (code: string) => Promise<void>;
  clearAccountDeletionVerification: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const accountDeletionVerificationIdRef = useRef<string | null>(null);
  const smsRequestRef = useRef<Promise<void> | null>(null);
  const accountDeletionSmsRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    try {
      return subscribeToAuthState((user) => {
        setSession(user ? { userId: user.uid } : null);
        setStatus(user ? 'authenticated' : 'unauthenticated');
        setInitializationError(null);
      });
    } catch (error: unknown) {
      const authError = mapAuthError(error);
      queueMicrotask(() => {
        setInitializationError(authError.message);
        setStatus('unauthenticated');
      });
      return undefined;
    }
  }, []);

  const sendVerificationCode = useCallback(async (phoneNumber: string): Promise<void> => {
    if (smsRequestRef.current) return smsRequestRef.current;

    const request = (async () => {
      const confirmation = await requestPhoneVerification(phoneNumber);
      confirmationRef.current = confirmation;
      setPendingPhoneNumber(phoneNumber);
    })();

    smsRequestRef.current = request;
    try {
      await request;
    } finally {
      smsRequestRef.current = null;
    }
  }, []);

  const verifyCode = useCallback(async (code: string): Promise<void> => {
    if (!confirmationRef.current) throw new AuthFlowError('verification-session-expired');
    await confirmPhoneVerification(confirmationRef.current, code);
    confirmationRef.current = null;
    setPendingPhoneNumber(null);
  }, []);

  const clearVerification = useCallback(() => {
    confirmationRef.current = null;
    setPendingPhoneNumber(null);
  }, []);

  const logout = useCallback(async () => {
    await signOutCurrentUser();
    clearVerification();
    accountDeletionVerificationIdRef.current = null;
  }, [clearVerification]);

  const clearAccountDeletionVerification = useCallback(() => {
    accountDeletionVerificationIdRef.current = null;
  }, []);

  const sendAccountDeletionCode = useCallback(async () => {
    if (accountDeletionSmsRequestRef.current) return accountDeletionSmsRequestRef.current;
    const request = (async () => {
      accountDeletionVerificationIdRef.current = await requestAccountDeletionReauthentication();
    })();
    accountDeletionSmsRequestRef.current = request;
    try {
      await request;
    } finally {
      accountDeletionSmsRequestRef.current = null;
    }
  }, []);

  const confirmAccountDeletionCode = useCallback(async (code: string) => {
    const verificationId = accountDeletionVerificationIdRef.current;
    if (!verificationId) throw new AuthFlowError('verification-session-expired');
    await confirmAccountDeletionReauthentication(verificationId, code);
    accountDeletionVerificationIdRef.current = null;
  }, []);

  const deleteAccount = useCallback(async () => {
    await deleteCurrentAccount();
    clearVerification();
    clearAccountDeletionVerification();
  }, [clearAccountDeletionVerification, clearVerification]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      pendingPhoneNumber,
      initializationError,
      sendVerificationCode,
      verifyCode,
      clearVerification,
      logout,
      accountPhoneNumber: session ? getCurrentUserPhoneNumber() : null,
      deleteAccount,
      sendAccountDeletionCode,
      confirmAccountDeletionCode,
      clearAccountDeletionVerification,
    }),
    [clearAccountDeletionVerification, clearVerification, confirmAccountDeletionCode, deleteAccount, initializationError, logout, pendingPhoneNumber, sendAccountDeletionCode, sendVerificationCode, session, status, verifyCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
