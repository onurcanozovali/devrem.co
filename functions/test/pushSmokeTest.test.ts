/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePushSmokeTestUid } from '../src/pushSmokeTest';

test('push smoke test requires exactly one explicit valid UID', () => {
  assert.equal(parsePushSmokeTestUid(['--uid', 'firebase-user_1']), 'firebase-user_1');
  assert.throws(() => parsePushSmokeTestUid([]), /Usage/);
  assert.throws(() => parsePushSmokeTestUid(['firebase-user_1']), /Usage/);
  assert.throws(() => parsePushSmokeTestUid(['--uid', '../user']), /valid explicit Firebase UID/);
  assert.throws(() => parsePushSmokeTestUid(['--uid', 'user-1', '--uid', 'user-2']), /Usage/);
});
