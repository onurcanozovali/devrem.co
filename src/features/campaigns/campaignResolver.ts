import { isCampaignRenderable, type AppCampaignPlacement, type Campaign, type CampaignContext } from './campaignDomain';

export interface CampaignResolutionRequest {
  placement: AppCampaignPlacement;
  context: CampaignContext;
}

export type CampaignResolver = (request: CampaignResolutionRequest) => Campaign | null;

/** Production resolver foundation. No backend, listener, fixture, or network call exists yet. */
export const resolveCampaign: CampaignResolver = () => null;

export function resolveCampaignPlacement(request: CampaignResolutionRequest): Campaign | null {
  const campaign = resolveCampaign(request);
  return isCampaignRenderable(campaign, request.placement) ? campaign : null;
}
