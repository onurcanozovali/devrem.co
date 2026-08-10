export interface AccountDeletionDependencies {
  deleteAvatar: (uid: string) => Promise<void>;
  deleteNotificationData: (uid: string) => Promise<void>;
  deletePublicProfile: (uid: string) => Promise<void>;
  deleteProfile: (uid: string) => Promise<void>;
  deleteAuthUser: (uid: string) => Promise<void>;
  isAuthUserMissing: (error: unknown) => boolean;
}

export function getProfilePhotoPath(uid: string): string {
  return `users/${uid}/profile/avatar.jpg`;
}

export function isAuthUserMissing(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'auth/user-not-found';
}

export async function deleteAccountData(
  uid: string,
  dependencies: AccountDeletionDependencies,
): Promise<void> {
  await dependencies.deleteAvatar(uid);
  await dependencies.deletePublicProfile(uid);
  await dependencies.deleteNotificationData(uid);
  await dependencies.deleteProfile(uid);

  try {
    await dependencies.deleteAuthUser(uid);
  } catch (error: unknown) {
    if (!dependencies.isAuthUserMissing(error)) throw error;
  }
}