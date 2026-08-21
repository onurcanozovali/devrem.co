/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGAL_VERSIONS } from './legalConfig';
import {
  canSubmitRegistration,
  createCurrentLegalAcceptanceWrite,
  createRegistrationLegalState,
  getLegalDocumentPath,
  isCurrentLegalAcceptance,
} from './legalDomain';

test('registration legal choices are separate and default to false', () => {
  const state = createRegistrationLegalState();
  assert.deepEqual(state, { termsAccepted: false, privacyNoticeAcknowledged: false });
  assert.equal(canSubmitRegistration(state), false);
  assert.equal(canSubmitRegistration({ ...state, termsAccepted: true }), false);
  assert.equal(canSubmitRegistration({ termsAccepted: true, privacyNoticeAcknowledged: true }), true);
  assert.equal('privacyConsent' in state, false);
});

test('current terms acceptance and privacy acknowledgement are recorded as separate fields', () => {
  const timestamp = { kind: 'server-timestamp' };
  assert.deepEqual(createCurrentLegalAcceptanceWrite(timestamp), {
    termsAcceptedVersion: '2026-08-20-v1',
    termsAcceptedAt: timestamp,
    privacyNoticeAcknowledgedVersion: '2026-08-20-v1',
    privacyNoticeAcknowledgedAt: timestamp,
  });
  assert.equal('privacyConsentVersion' in createCurrentLegalAcceptanceWrite(timestamp), false);
});

test('legal document links map to separate app-owned screens', () => {
  assert.equal(getLegalDocumentPath('terms'), '/legal/terms');
  assert.equal(getLegalDocumentPath('privacy-notice'), '/legal/privacy-notice');
});

test('only the current terms and privacy acknowledgement versions satisfy the gate', () => {
  const current = {
    termsAcceptedVersion: LEGAL_VERSIONS.terms,
    termsAcceptedAt: new Date(),
    privacyNoticeAcknowledgedVersion: LEGAL_VERSIONS.privacyNotice,
    privacyNoticeAcknowledgedAt: new Date(),
  };
  assert.equal(isCurrentLegalAcceptance(current), true);
  assert.equal(isCurrentLegalAcceptance({ ...current, termsAcceptedVersion: 'old' }), false);
  assert.equal(isCurrentLegalAcceptance({ ...current, privacyNoticeAcknowledgedAt: null }), false);
  assert.equal('hasAcceptedPrivacy' in current, false);
});
