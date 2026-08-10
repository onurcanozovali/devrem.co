/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { consumeGroupChatReturnSuppression, markReturningFromGroupChat } from './groupChatNavigation';

test('return suppression is consumed exactly once and does not block future tab entries', () => {
  assert.equal(consumeGroupChatReturnSuppression(), false);
  markReturningFromGroupChat();
  assert.equal(consumeGroupChatReturnSuppression(), true);
  assert.equal(consumeGroupChatReturnSuppression(), false);
});
