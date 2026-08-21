/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { filterVisibleDirectConversationRows } from './directConversationDomain';
import { DIRECT_INBOX_REALTIME_LISTENER_COUNT, subscribeToDirectInboxSources } from './directInboxSubscriptions';
import {
  clearVisibleDirectConversationCache,
  forgetVisibleDirectConversation,
  getCachedDirectRecipientUid,
  getCachedVisibleDirectConversationId,
  rememberVisibleDirectConversation,
} from './directConversationCache';

test('inbox keeps normal and blocked conversations but removes only participant-hidden rows', () => {
  const rows = [
    { id: 'normal', blocked: false, hidden: false },
    { id: 'blocked', blocked: true, hidden: false },
    { id: 'hidden', blocked: false, hidden: true },
  ];
  assert.deepEqual(filterVisibleDirectConversationRows(rows).map(({ id }) => id), ['normal', 'blocked']);
});

test('reporting is not modeled as inbox visibility state', () => {
  const reportedConversation = { id: 'reported', blocked: false, hidden: false };
  assert.deepEqual(filterVisibleDirectConversationRows([reportedConversation]), [reportedConversation]);
});

test('only visible direct conversations use the instant profile-to-chat path', () => {
  clearVisibleDirectConversationCache();
  rememberVisibleDirectConversation('user-b', 'user-a', 'conversation-1');
  assert.equal(getCachedVisibleDirectConversationId('user-a', 'user-b'), 'conversation-1');
  assert.equal(getCachedDirectRecipientUid('conversation-1', 'user-a'), 'user-b');

  forgetVisibleDirectConversation('user-a', 'user-b');
  assert.equal(getCachedVisibleDirectConversationId('user-b', 'user-a'), null);
});

test('inbox uses three shared realtime listeners regardless of DM row count and cleans each once', () => {
  const subscribed: number[] = [];
  const unsubscribed: number[] = [];
  const source = (id: number) => () => {
    subscribed.push(id);
    return () => { unsubscribed.push(id); };
  };
  const sources = [source(0), source(1), source(2)] as const;
  const stop = subscribeToDirectInboxSources(sources);
  assert.equal(DIRECT_INBOX_REALTIME_LISTENER_COUNT, 3);
  assert.deepEqual(subscribed, [0, 1, 2]);
  stop();
  assert.deepEqual(unsubscribed, [0, 1, 2]);
});
