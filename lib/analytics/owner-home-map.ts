import type { AnalyticsFleetStatus, AnalyticsTopDriver, FinanceReportBucket, FinanceReportResponse, OwnerDashboardSummary } from '@/lib/types/analytics';

const WEEKDAY_SHORT_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function shortWeekdayFromDate(d: Date): string {
  return WEEKDAY_SHORT_VI[d.getDay()] ?? '?';
}

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function firstNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = pickNumber(o[k]);
    if (n != null) return n;
  }
  return null;
}

export function revenueFromSummary(s: OwnerDashboardSummary): number | null {
  return firstNumber(s as Record<string, unknown>, ['revenue', 'totalRevenue', 'todayRevenue']);
}

export function profitFromSummary(s: OwnerDashboardSummary): number | null {
  return firstNumber(s as Record<string, unknown>, ['profit', 'totalProfit', 'todayProfit']);
}

export function totalWeightFromSummary(s: OwnerDashboardSummary): number | null {
  return firstNumber(s as Record<string, unknown>, ['totalWeight', 'weightTotal', 'weight']);
}

export function dailyAvgWeightFromSummary(s: OwnerDashboardSummary): number | null {
  return firstNumber(s as Record<string, unknown>, ['dailyAvgWeight', 'avgDailyWeight', 'averageDailyWeight']);
}

export function marginPercentFromSummary(s: OwnerDashboardSummary): number | null {
  return firstNumber(s as Record<string, unknown>, ['marginPercent', 'margin']);
}

export type TrendDir = 'up' | 'down' | 'neutral';

export function trendFromPercent(p: number | null | undefined): TrendDir {
  if (p == null || !Number.isFinite(p)) return 'neutral';
  if (p > 0.0001) return 'up';
  if (p < -0.0001) return 'down';
  return 'neutral';
}

export function formatSignedPercent(p: number | null | undefined): string | null {
  if (p == null || !Number.isFinite(p)) return null;
  const abs = Math.abs(p);
  const s = abs % 1 === 0 ? String(abs) : abs.toFixed(1).replace('.', ',');
  const sign = p > 0 ? '+' : p < 0 ? '-' : '';
  return `${sign}${s}%`;
}

export type FleetUi = {
  active: number;
  maintenance: number;
  idle: number;
  total: number;
};

export function fleetFromStatus(fs: AnalyticsFleetStatus | null | undefined): FleetUi | null {
  if (!fs || typeof fs !== 'object') return null;
  const o = fs as Record<string, unknown>;
  const active = Math.max(0, Math.round(firstNumber(o, ['active', 'activeCount', 'running']) ?? 0));
  const maintenance = Math.max(
    0,
    Math.round(firstNumber(o, ['maintenance', 'maintenanceCount', 'inMaintenance']) ?? 0),
  );
  const idle = Math.max(0, Math.round(firstNumber(o, ['idle', 'idleCount', 'offDuty', 'rest']) ?? 0));
  const totalExplicit = firstNumber(o, ['total', 'totalVehicles', 'count']);
  const sum = active + maintenance + idle;
  const total = totalExplicit != null && totalExplicit > 0 ? Math.round(totalExplicit) : sum;
  if (total <= 0 && sum <= 0) return null;
  return {
    active,
    maintenance,
    idle,
    total: total > 0 ? total : sum,
  };
}

export type TopDriverUi = {
  name: string;
  initial: string;
  deliveries: number | null;
  revenue: number | null;
  rating: number | null;
  tier: string | null;
};

export function topDriverFromSummary(d: AnalyticsTopDriver | null | undefined): TopDriverUi | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  let name =
    (typeof o.displayName === 'string' && o.displayName.trim()) ||
    (typeof o.name === 'string' && o.name.trim()) ||
    '';
  if (!name) {
    const fn = typeof o.firstName === 'string' ? o.firstName.trim() : '';
    const ln = typeof o.lastName === 'string' ? o.lastName.trim() : '';
    name = [fn, ln].filter(Boolean).join(' ').trim();
  }
  if (!name) return null;

  const initial = name.trim().slice(0, 1).toUpperCase() || '?';
  const deliveries = firstNumber(o, ['deliveries', 'tripCount', 'trips']);
  const revenue = firstNumber(o, ['revenue', 'totalRevenue']);
  const rating = firstNumber(o, ['rating', 'ratingAverage', 'avgRating']);
  const tier =
    (typeof o.tierName === 'string' && o.tierName.trim()) ||
    (typeof o.tier === 'string' && o.tier.trim()) ||
    null;

  return {
    name,
    initial,
    deliveries,
    revenue,
    rating,
    tier,
  };
}

function extractBuckets(body: FinanceReportResponse): FinanceReportBucket[] {
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.series)) return body.series;
  if (Array.isArray(body.buckets)) return body.buckets;
  return [];
}

function bucketTimestamp(b: FinanceReportBucket): number {
  const raw = b.date ?? b.bucketDate ?? b.period ?? b.label;
  if (raw == null) return 0;
  const s = String(raw);
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function bucketValue(b: FinanceReportBucket): number {
  const o = b as Record<string, unknown>;
  const v = firstNumber(o, ['revenue', 'totalRevenue', 'profit', 'amount', 'value']);
  return v != null && v >= 0 ? v : 0;
}

export type ChartBar = { value: number; label: string };

/** Chuẩn hoá báo cáo finance → tối đa 7 cột, nhãn theo thứ (VI). */
export function buildPerformanceBarsFromFinanceReport(body: FinanceReportResponse | null | undefined): ChartBar[] | null {
  if (!body) return null;
  const buckets = extractBuckets(body);
  if (!buckets.length) return null;

  const withIdx = buckets.map((b, i) => ({ b, i, t: bucketTimestamp(b) }));
  const hasDates = withIdx.some((x) => x.t > 0);
  const sorted = hasDates
    ? [...withIdx].sort((a, x) => a.t - x.t)
    : [...withIdx].sort((a, x) => a.i - x.i);

  const last = sorted.slice(-7);
  const bars: ChartBar[] = last.map(({ b, t }) => {
    const value = bucketValue(b);
    let label: string;
    if (t > 0) {
      label = shortWeekdayFromDate(new Date(t));
    } else {
      const lb = b.label != null ? String(b.label).trim() : '';
      label = lb || '?';
    }
    return { value, label };
  });

  if (!bars.length) return null;
  return bars;
}

export function chartMaxValue(bars: ChartBar[]): number {
  const max = Math.max(...bars.map((x) => x.value), 0);
  if (max <= 0) return 100;
  return max * 1.12;
}
