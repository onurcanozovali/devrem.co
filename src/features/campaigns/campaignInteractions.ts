import type { Campaign, CampaignContext, CampaignDestination, CampaignTrackingEvent } from './campaignDomain';
import { createCampaignTrackingEvent } from './campaignDomain';

export interface CampaignInteractionAdapter {
  recordEvent?: (event: CampaignTrackingEvent) => void | Promise<void>;
  openDestination: (destination: CampaignDestination) => void | Promise<void>;
}

export async function handleCampaignClick(
  campaign: Campaign,
  context: CampaignContext,
  adapter: CampaignInteractionAdapter,
): Promise<CampaignTrackingEvent> {
  const event = createCampaignTrackingEvent('campaign_click', campaign, context);
  await adapter.recordEvent?.(event);
  await adapter.openDestination(campaign.destination);
  return event;
}

/** Called only by a future viewability layer after the sponsored card is actually visible. */
export function createVisibleCampaignImpression(campaign: Campaign, context: CampaignContext): CampaignTrackingEvent {
  return createCampaignTrackingEvent('campaign_impression', campaign, context);
}
