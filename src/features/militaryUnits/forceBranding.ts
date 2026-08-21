import rawCatalog from '@/data/militaryUnits.v4.json';
import { forceCodes, type ForceBranding, type ForceCode } from './types';

const accents: Record<ForceCode, string> = {
  land: '#4F6B45',
  air: '#3977A8',
  navy: '#285C83',
  gendarmerie: '#B34B45',
  coast_guard: '#D07A35',
};

const fallbackNames: Record<ForceCode, string> = {
  land: 'Kara Kuvvetleri',
  air: 'Hava Kuvvetleri',
  navy: 'Deniz Kuvvetleri',
  gendarmerie: 'Jandarma',
  coast_guard: 'Sahil Güvenlik',
};

const sourceForces = (rawCatalog as unknown as { forceCodes?: unknown[] }).forceCodes ?? [];
const branding = new Map<ForceCode, ForceBranding>(forceCodes.map((code) => {
  const source = sourceForces.find((item): item is Record<string, unknown> => (
    typeof item === 'object' && item !== null && (item as Record<string, unknown>).code === code
  ));
  const displayName = typeof source?.name === 'string' && source.name.trim() ? source.name.trim() : fallbackNames[code];
  const logoUrl = typeof source?.logo === 'string' && source.logo.trim() ? source.logo.trim() : null;
  return [code, { code, displayName, logoUrl, accentColor: accents[code] }];
}));

export function getForceBranding(forceCode: ForceCode | null | undefined): ForceBranding | null {
  return forceCode ? branding.get(forceCode) ?? null : null;
}

export function getForceLogoUrl(forceCode: ForceCode | null | undefined): string | null {
  return getForceBranding(forceCode)?.logoUrl ?? null;
}

export function getForceDisplayName(forceCode: ForceCode | null | undefined): string {
  return getForceBranding(forceCode)?.displayName ?? 'Kuvvet bilgisi henüz doğrulanmadı';
}
