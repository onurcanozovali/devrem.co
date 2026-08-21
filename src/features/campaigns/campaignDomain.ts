import { forceCodes, type ForceCode } from '@/features/militaryUnits/types';
import { militaryTypes, type MilitaryType } from '@/features/profile/types/profile';

export const APP_CAMPAIGN_PLACEMENTS = [
  'home_transport_offer',
  'preparation_inline_offer',
  'preparation_category_offer',
  'unit_transport_offer',
] as const;

export type AppCampaignPlacement = (typeof APP_CAMPAIGN_PLACEMENTS)[number];
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
export type CampaignDisclosureLabel = 'Sponsorlu' | 'İş Birliği';

export interface CampaignCreative {
  title: string;
  description?: string;
  imageUrl?: string;
  logoUrl?: string;
  ctaLabel: string;
}

export interface CampaignDestination {
  url?: string;
  deepLink?: string;
}

export interface CampaignTargeting {
  militaryCityIds?: readonly string[];
  militaryUnitIds?: readonly string[];
  forceCodes?: readonly ForceCode[];
  militaryTypes?: readonly MilitaryType[];
  conscriptionPeriods?: readonly `${number}-${number}`[];
  preparationCategories?: readonly string[];
}

export interface Campaign {
  id: string;
  advertiserId: string;
  name: string;
  status: CampaignStatus;
  placement: AppCampaignPlacement;
  creative: CampaignCreative;
  destination: CampaignDestination;
  targeting: CampaignTargeting;
  startAt: string;
  endAt: string;
  disclosureLabel: CampaignDisclosureLabel;
  tracking: {
    impressionEnabled: boolean;
    clickEnabled: boolean;
  };
}

/** Explicitly allow-listed, contextual input. Unknown/PII keys are discarded at runtime. */
export interface CampaignContextInput {
  departureCityId?: unknown;
  militaryCityId?: unknown;
  militaryUnitId?: unknown;
  forceCode?: unknown;
  militaryType?: unknown;
  conscriptionPeriodYear?: unknown;
  conscriptionPeriodMonth?: unknown;
  daysUntilService?: unknown;
  serviceDate?: unknown;
  preparationCategory?: unknown;
}

export interface CampaignContext {
  placement: AppCampaignPlacement;
  departureCityId?: string;
  militaryCityId?: string;
  militaryUnitId?: string;
  forceCode?: ForceCode;
  militaryType?: MilitaryType;
  conscriptionPeriodYear?: number;
  conscriptionPeriodMonth?: number;
  daysUntilService?: number;
  serviceDate?: string;
  preparationCategory?: string;
}

export type CampaignTrackingEventName = 'campaign_impression' | 'campaign_click';

export interface CampaignTrackingEvent {
  name: CampaignTrackingEventName;
  campaignId: string;
  placement: AppCampaignPlacement;
  advertiserId: string;
  context: Pick<CampaignContext,
    'militaryCityId' | 'militaryUnitId' | 'forceCode' | 'militaryType'
    | 'conscriptionPeriodYear' | 'conscriptionPeriodMonth' | 'preparationCategory'>;
}

export function isAppCampaignPlacement(value: unknown): value is AppCampaignPlacement {
  return typeof value === 'string' && APP_CAMPAIGN_PLACEMENTS.includes(value as AppCampaignPlacement);
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160 ? value.trim() : undefined;
}

function safeId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value);
  return safeString(value);
}

function safeInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum ? value : undefined;
}

export function createCampaignContext(placement: AppCampaignPlacement, input: CampaignContextInput = {}): CampaignContext {
  const context: CampaignContext = { placement };
  const departureCityId = safeId(input.departureCityId);
  const militaryCityId = safeId(input.militaryCityId);
  const militaryUnitId = safeId(input.militaryUnitId);
  const preparationCategory = safeString(input.preparationCategory);
  const serviceDate = typeof input.serviceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)
    ? input.serviceDate : undefined;
  const year = safeInteger(input.conscriptionPeriodYear, 2000, 2200);
  const month = safeInteger(input.conscriptionPeriodMonth, 1, 12);
  const days = safeInteger(input.daysUntilService, 0, 3650);
  if (departureCityId) context.departureCityId = departureCityId;
  if (militaryCityId) context.militaryCityId = militaryCityId;
  if (militaryUnitId) context.militaryUnitId = militaryUnitId;
  if (forceCodes.includes(input.forceCode as ForceCode)) context.forceCode = input.forceCode as ForceCode;
  if (militaryTypes.includes(input.militaryType as MilitaryType)) context.militaryType = input.militaryType as MilitaryType;
  if (year !== undefined) context.conscriptionPeriodYear = year;
  if (month !== undefined) context.conscriptionPeriodMonth = month;
  if (days !== undefined) context.daysUntilService = days;
  if (serviceDate) context.serviceDate = serviceDate;
  if (preparationCategory) context.preparationCategory = preparationCategory;
  return context;
}

function isSafeDestination(destination: CampaignDestination | undefined): boolean {
  const safeUrl = typeof destination?.url === 'string' && destination.url.startsWith('https://');
  const safeDeepLink = typeof destination?.deepLink === 'string' && destination.deepLink.startsWith('devrem://');
  return safeUrl || safeDeepLink;
}

function isSafeOptionalRemoteImage(value: string | undefined): boolean {
  return value === undefined || value.startsWith('https://');
}

export function isCampaignRenderable(campaign: Campaign | null, placement: AppCampaignPlacement, now = new Date()): campaign is Campaign {
  if (campaign === null) return false;
  const startAt = Date.parse(campaign.startAt);
  const endAt = Date.parse(campaign.endAt);
  return Number.isFinite(startAt)
    && Number.isFinite(endAt)
    && startAt <= now.getTime()
    && endAt >= now.getTime()
    && campaign.status === 'active'
    && campaign.placement === placement
    && (campaign.disclosureLabel === 'Sponsorlu' || campaign.disclosureLabel === 'İş Birliği')
    && typeof campaign.creative?.title === 'string'
    && campaign.creative.title.trim().length > 0
    && typeof campaign.creative.ctaLabel === 'string'
    && campaign.creative.ctaLabel.trim().length > 0
    && isSafeOptionalRemoteImage(campaign.creative.imageUrl)
    && isSafeOptionalRemoteImage(campaign.creative.logoUrl)
    && isSafeDestination(campaign.destination);
}

export function createCampaignTrackingEvent(name: CampaignTrackingEventName, campaign: Campaign, context: CampaignContext): CampaignTrackingEvent {
  const safeContext: CampaignTrackingEvent['context'] = {};
  if (context.militaryCityId) safeContext.militaryCityId = context.militaryCityId;
  if (context.militaryUnitId) safeContext.militaryUnitId = context.militaryUnitId;
  if (context.forceCode) safeContext.forceCode = context.forceCode;
  if (context.militaryType) safeContext.militaryType = context.militaryType;
  if (context.conscriptionPeriodYear) safeContext.conscriptionPeriodYear = context.conscriptionPeriodYear;
  if (context.conscriptionPeriodMonth) safeContext.conscriptionPeriodMonth = context.conscriptionPeriodMonth;
  if (context.preparationCategory) safeContext.preparationCategory = context.preparationCategory;
  return { name, campaignId: campaign.id, placement: campaign.placement, advertiserId: campaign.advertiserId, context: safeContext };
}
