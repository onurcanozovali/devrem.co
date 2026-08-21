import type { ConfirmationResult } from '@react-native-firebase/auth';
import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  confirmAccountDeletionReauthentication,
  confirmPhoneVerification,
  deleteCurrentAccount,
  deleteCurrentNotificationDevice,
  fetchLegalAcceptance,
  getCurrentUserPhoneNumber,
  requestAccountDeletionReauthentication,
  requestPhoneVerification,
  recordCurrentLegalAcceptance,
  signOutCurrentUser,
  subscribeToAuthState,
} from '@/services/firebase';
import { canSubmitRegistration, isCurrentLegalAcceptance, type RegistrationLegalState } from '@/features/legal/legalDomain';
import { AuthFlowError, mapAuthError } from './services/authErrors';
import type { AuthSession, AuthStatus } from './types/auth';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  pendingPhoneNumber: string | null;
  initializationError: string | null;
  sendVerificationCode: (phoneNumber: string, legalState?: RegistrationLegalState) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  clearVerification: () => void;
  logout: () => Promise<void>;
  accountPhoneNumber: string | null;
  deleteAccount: () => Promise<void>;
  sendAccountDeletionCode: () => Promise<void>;
  confirmAccountDeletionCode: (code: string) => Promise<void>;
  clearAccountDeletionVerification: () => void;
  legalStatus: 'idle' | 'loading' | 'current' | 'required' | 'error';
  legalError: string | null;
  refreshLegalAcceptance: () => Promise<void>;
  acceptLegalUpdate: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [legalStatus, setLegalStatus] = useState<'idle' | 'loading' | 'current' | 'required' | 'error'>('idle');
  const [legalError, setLegalError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const accountDeletionVerificationIdRef = useRef<string | null>(null);
  const smsRequestRef = useRef<Promise<void> | null>(null);
  const pendingLegalStateRef = useRef<RegistrationLegalState | null>(null);
  const legalRequestIdRef = useRef(0);
  const accountDeletionSmsRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    try {
      return subscribeToAuthState((user) => {
        setSession(user ? { userId: user.uid } : null);
        setStatus(user ? 'authenticated' : 'unauthenticated');
        setInitializationError(null);
        const requestId = legalRequestIdRef.current + 1;
        legalRequestIdRef.current = requestId;
        if (!user) {
          setLegalStatus('idle');
          setLegalError(null);
          return;
        }
        setLegalStatus('loading');
        setLegalError(null);
        void fetchLegalAcceptance(user.uid)
          .then((record) => {
            if (legalRequestIdRef.current !== requestId) return;
            const current = isCurrentLegalAcceptance(record);
            setLegalStatus(current ? 'current' : 'required');
            if (__DEV__ && !current) console.warn('Current development account has no acceptance record for the active legal versions.');
          })
          .catch(() => {
            if (legalRequestIdRef.current !== requestId) return;
            setLegalError('Yasal kayıt bilgileri yüklenemedi. Bağlantını kontrol edip tekrar dene.');
            setLegalStatus('error');
          });
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

  const sendVerificationCode = useCallback(async (phoneNumber: string, legalState?: RegistrationLegalState): Promise<void> => {
    if (smsRequestRef.current) return smsRequestRef.current;
    if (legalState && !canSubmitRegistration(legalState)) throw new AuthFlowError('configuration-error');

    const request = (async () => {
      const confirmation = await requestPhoneVerification(phoneNumber);
      confirmationRef.current = confirmation;
      setPendingPhoneNumber(phoneNumber);
      if (legalState) pendingLegalStateRef.current = legalState;
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
    if (!pendingLegalStateRef.current || !canSubmitRegistration(pendingLegalStateRef.current)) {
      throw new AuthFlowError('configuration-error');
    }
    const uid = await confirmPhoneVerification(confirmationRef.current, code);
    await recordCurrentLegalAcceptance(uid);
    legalRequestIdRef.current += 1;
    setLegalStatus('current');
    setLegalError(null);
    confirmationRef.current = null;
    pendingLegalStateRef.current = null;
    setPendingPhoneNumber(null);
  }, []);

  const clearVerification = useCallback(() => {
    confirmationRef.current = null;
    pendingLegalStateRef.current = null;
    setPendingPhoneNumber(null);
  }, []);

  const refreshLegalAcceptance = useCallback(async () => {
    if (!session) return;
    const requestId = legalRequestIdRef.current + 1;
    legalRequestIdRef.current = requestId;
    setLegalStatus('loading');
    setLegalError(null);
    try {
      const record = await fetchLegalAcceptance(session.userId);
      if (legalRequestIdRef.current === requestId) setLegalStatus(isCurrentLegalAcceptance(record) ? 'current' : 'required');
    } catch {
      if (legalRequestIdRef.current !== requestId) return;
      setLegalError('Yasal kayıt bilgileri yüklenemedi. Bağlantını kontrol edip tekrar dene.');
      setLegalStatus('error');
    }
  }, [session]);

  const acceptLegalUpdate = useCallback(async () => {
    if (!session) throw new AuthFlowError('configuration-error');
    setLegalError(null);
    try {
      await recordCurrentLegalAcceptance(session.userId);
      setLegalStatus('current');
    } catch {
      setLegalError('Yasal tercihler kaydedilemedi. Bağlantını kontrol edip tekrar dene.');
      throw new AuthFlowError('network-request-failed');
    }
  }, [session]);

  const logout = useCallback(async () => {
    if (session) await deleteCurrentNotificationDevice(session.userId);
    await signOutCurrentUser();
    clearVerification();
    accountDeletionVerificationIdRef.current = null;
  }, [clearVerification, session]);

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
      legalStatus,
      legalError,
      refreshLegalAcceptance,
      acceptLegalUpdate,
    }),
    [acceptLegalUpdate, clearAccountDeletionVerification, clearVerification, confirmAccountDeletionCode, deleteAccount, initializationError, legalError, legalStatus, logout, pendingPhoneNumber, refreshLegalAcceptance, sendAccountDeletionCode, sendVerificationCode, session, status, verifyCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
