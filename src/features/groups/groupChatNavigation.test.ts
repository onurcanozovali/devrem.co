/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getGroupChatReturnPath,
  parseGroupChatReturnPath,
  rememberGroupChatReturnTab,
} from './groupChatNavigation';

test('group chat remembers every safe return tab including the group list', () => {
  rememberGroupChatReturnTab('matching');
  assert.equal(getGroupChatReturnPath(), '/(tabs)/matching');
  rememberGroupChatReturnTab('chats');
  assert.equal(getGroupChatReturnPath(), '/(tabs)/chats');
  rememberGroupChatReturnTab('profile');
  assert.equal(getGroupChatReturnPath(), '/(tabs)/profile');
});

test('group chat accepts only allow-listed return destinations', () => {
  assert.equal(parseGroupChatReturnPath('/(tabs)/preparation'), '/(tabs)/preparation');
  assert.equal(parseGroupChatReturnPath('/group-chat/unsafe'), null);
  assert.equal(parseGroupChatReturnPath(['/(tabs)']), null);
});
