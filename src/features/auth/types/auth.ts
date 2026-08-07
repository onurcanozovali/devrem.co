export type AuthStatus = 'initializing' | 'unauthenticated' | 'authenticated';

export interface AuthSession {
  userId: string;
}

export type AuthErrorCode =
  | 'invalid-phone-number'
  | 'network-request-failed'
  | 'invalid-verification-code'
  | 'verification-code-expired'
  | 'too-many-requests'
  | 'quota-exceeded'
  | 'verification-cancelled'
  | 'verification-session-expired'
  | 'configuration-error'
  | 'unknown';
