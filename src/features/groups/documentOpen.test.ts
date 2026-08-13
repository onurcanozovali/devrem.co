import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANDROID_GRANT_READ_URI_PERMISSION,
  ANDROID_VIEW_ACTION,
  getDocumentOpenDescriptor,
} from './documentOpenDomain';

test('document tap maps to Android VIEW with MIME and temporary read permission', () => {
  const descriptor = getDocumentOpenDescriptor('application/pdf');

  assert.equal(descriptor.action, ANDROID_VIEW_ACTION);
  assert.notEqual(descriptor.action, 'android.intent.action.SEND');
  assert.equal(descriptor.mimeType, 'application/pdf');
  assert.equal(descriptor.flags, ANDROID_GRANT_READ_URI_PERMISSION);
});
