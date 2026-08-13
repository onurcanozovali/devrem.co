export const ANDROID_VIEW_ACTION = 'android.intent.action.VIEW';
export const ANDROID_GRANT_READ_URI_PERMISSION = 1;

export interface DocumentOpenDescriptor {
  action: typeof ANDROID_VIEW_ACTION;
  flags: typeof ANDROID_GRANT_READ_URI_PERMISSION;
  mimeType: string;
}

export function getDocumentOpenDescriptor(mimeType: string): DocumentOpenDescriptor {
  return {
    action: ANDROID_VIEW_ACTION,
    flags: ANDROID_GRANT_READ_URI_PERMISSION,
    mimeType,
  };
}
