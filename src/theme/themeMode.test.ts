import assert from 'node:assert/strict';
import test from 'node:test';

import { parseThemeMode, resolveThemeMode } from './themeMode';

test('theme preference accepts exactly system, light, and dark', () => {
  assert.equal(parseThemeMode('system'), 'system');
  assert.equal(parseThemeMode('light'), 'light');
  assert.equal(parseThemeMode('dark'), 'dark');
  assert.equal(parseThemeMode('sepia'), 'system');
  assert.equal(parseThemeMode(null), 'system');
});

test('system follows device appearance while explicit modes remain fixed', () => {
  assert.equal(resolveThemeMode('system', 'dark'), 'dark');
  assert.equal(resolveThemeMode('system', 'light'), 'light');
  assert.equal(resolveThemeMode('system', null), 'light');
  assert.equal(resolveThemeMode('light', 'dark'), 'light');
  assert.equal(resolveThemeMode('dark', 'light'), 'dark');
});