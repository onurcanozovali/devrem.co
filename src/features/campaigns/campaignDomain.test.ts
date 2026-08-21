/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCampaignContext,
  createCampaignTrackingEvent,
  isAppCampaignPlacement,
  isCampaignRenderable,
  type Campaign,
  type CampaignContextInput,
} from './campaignDomain';
import { handleCampaignClick } from './campaignInteractions';
import { resolveCampaign, resolveCampaignPlacement } from './campaignResolver';

const campaign: Campaign = {
  id: 'campaign-1',
  advertiserId: 'advertiser-1',
  name: 'Ulaşım iş birliği',
  status: 'active',
  placement: 'home_transport_offer',
  creative: { title: 'Biletleri karşılaştır', ctaLabel: 'Bilet Bul' },
  destination: { url: 'https://partner.example/offer' },
  targeting: {},
  startAt: '2026-01-01T00:00:00.000Z',
  endAt: '2026-12-31T23:59:59.999Z',
  disclosureLabel: 'Sponsorlu',
  tracking: { impressionEnabled: true, clickEnabled: true },
};

test('placement IDs are centralized and reject unknown values', () => {
  assert.equal(isAppCampaignPlacement('home_transport_offer'), true);
  assert.equal(isAppCampaignPlacement('direct_message_offer'), false);
  assert.equal(isAppCampaignPlacement('unknown'), false);
});

test('no campaign resolves, so CampaignPlacement receives no render model', () => {
  const context = createCampaignContext('home_transport_offer');
  assert.equal(resolveCampaign({ placement: 'home_transport_offer', context }), null);
  assert.equal(resolveCampaignPlacement({ placement: 'home_transport_offer', context }), null);
});

test('safe context keeps only contextual allow-listed fields and discards PII', () => {
  const unsafeInput = {
    militaryCityId: 43,
    militaryUnitId: 'unit-1',
    militaryType: 'paid',
    conscriptionPeriodYear: 2026,
    conscriptionPeriodMonth: 8,
    phoneNumber: '+905551112233',
    email: 'user@example.com',
    firstName: 'Onurcan',
    directMessage: 'private text',
    blockedUsers: ['uid'],
  } as CampaignContextInput;
  const context = createCampaignContext('unit_transport_offer', unsafeInput);
  assert.deepEqual(context, {
    placement: 'unit_transport_offer',
    militaryCityId: '43',
    militaryUnitId: 'unit-1',
    militaryType: 'paid',
    conscriptionPeriodYear: 2026,
    conscriptionPeriodMonth: 8,
  });
  for (const forbidden of ['phoneNumber', 'email', 'firstName', 'directMessage', 'blockedUsers']) {
    assert.equal(forbidden in context, false);
  }
});

test('campaign disclosure, active dates, placement, creative and destination are required', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  assert.equal(isCampaignRenderable(campaign, 'home_transport_offer', now), true);
  assert.equal(isCampaignRenderable({ ...campaign, disclosureLabel: '' as Campaign['disclosureLabel'] }, 'home_transport_offer', now), false);
  assert.equal(isCampaignRenderable({ ...campaign, endAt: '2026-01-02T00:00:00.000Z' }, 'home_transport_offer', now), false);
  assert.equal(isCampaignRenderable({ ...campaign, destination: {} }, 'home_transport_offer', now), false);
  assert.equal(isCampaignRenderable({ ...campaign, destination: { url: 'http://unsafe.example' } }, 'home_transport_offer', now), false);
});

test('click contract records only safe metadata before opening the destination', async () => {
  const context = createCampaignContext('home_transport_offer', {
    departureCityId: 55,
    militaryCityId: 43,
    militaryUnitId: 'unit-1',
    conscriptionPeriodYear: 2026,
    conscriptionPeriodMonth: 8,
    serviceDate: '2026-08-24',
  });
  const calls: string[] = [];
  const event = await handleCampaignClick(campaign, context, {
    recordEvent: (value) => { calls.push(value.name); },
    openDestination: () => { calls.push('open'); },
  });
  assert.deepEqual(calls, ['campaign_click', 'open']);
  assert.deepEqual(event, createCampaignTrackingEvent('campaign_click', campaign, context));
  assert.deepEqual(event.context, {
    militaryCityId: '43',
    militaryUnitId: 'unit-1',
    conscriptionPeriodYear: 2026,
    conscriptionPeriodMonth: 8,
  });
  assert.equal('departureCityId' in event.context, false);
  assert.equal('serviceDate' in event.context, false);
});
