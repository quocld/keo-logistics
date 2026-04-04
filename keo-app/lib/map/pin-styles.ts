import { Brand } from '@/constants/brand';

const S = Brand.stitch;

/** Align with harvest-areas list normalization */
export function normalizeHarvestStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

/** Align with weighing-stations list */
export function normalizeStationStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

/** Pin ring / icon color by harvest area status — mirrors cardUiForStatus accents */
export function harvestAreaPinColor(status: string): string {
  switch (status) {
    case 'active':
      return '#006d42';
    case 'preparing':
      return `${S.outlineVariant}`;
    case 'paused':
    case 'awaiting_renewal':
      return S.tertiary;
    case 'completed':
      return S.outlineVariant;
    case 'inactive':
      return S.surfaceDim;
    default:
      return S.surfaceDim;
  }
}

/** Pin color by weighing station status — mirrors stationAccent */
export function weighingStationPinColor(status: string): string {
  if (status.includes('active') || status === '1') return S.primary;
  if (status.includes('inactive') || status.includes('disabled')) return S.outlineVariant;
  if (status) return S.primaryContainer;
  return S.primary;
}

export type DriverFreshness = 'active' | 'stale' | 'offline';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

export function getDriverFreshness(timestamp: string | undefined | null): DriverFreshness {
  if (!timestamp) return 'offline';
  const age = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(age)) return 'offline';
  if (age < STALE_THRESHOLD_MS) return 'active';
  if (age < OFFLINE_THRESHOLD_MS) return 'stale';
  return 'offline';
}

export function driverPinColor(freshness: DriverFreshness): string {
  switch (freshness) {
    case 'active':
      return '#006d42';
    case 'stale':
      return S.tertiary;
    case 'offline':
      return S.outlineVariant;
  }
}
