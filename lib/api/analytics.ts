import type { FinanceReportResponse, OwnerDashboardSummary } from '@/lib/types/analytics';

import { apiFetch } from './client';
import { formatApiErrorFromJsonText, formatApiErrorPayload } from './errors';

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export type DashboardSummaryResult =
  | { ok: true; body: OwnerDashboardSummary }
  | { ok: false; message: string };

export async function getDashboardSummary(params: { range: string }): Promise<DashboardSummaryResult> {
  const qs = buildQuery({ range: params.range });
  const res = await apiFetch(`/analytics/dashboard/summary${qs}`);

  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        message: formatApiErrorFromJsonText(text, res.statusText, res.status),
      };
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      message: formatApiErrorPayload(parsed, res.statusText, res.status),
    };
  }

  return { ok: true, body: parsed as OwnerDashboardSummary };
}

export type FinanceReportResult =
  | { ok: true; body: FinanceReportResponse }
  | { ok: false; message: string };

export async function getFinanceReport(params: {
  range: string;
  groupBy: 'day' | 'week' | 'month';
}): Promise<FinanceReportResult> {
  const qs = buildQuery({ range: params.range, groupBy: params.groupBy });
  const res = await apiFetch(`/analytics/reports/finance${qs}`);

  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        message: formatApiErrorFromJsonText(text, res.statusText, res.status),
      };
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      message: formatApiErrorPayload(parsed, res.statusText, res.status),
    };
  }

  return { ok: true, body: parsed as FinanceReportResponse };
}

/** Thử lần lượt các giá trị `range` phổ biến cho 7 ngày (backend có thể khác tên). */
const FINANCE_RANGE_7D_CANDIDATES = ['last_7_days', 'last7days', '7d', 'week'] as const;

export async function getFinanceReportLast7Days(): Promise<FinanceReportResult> {
  let lastMessage = 'Không tải được báo cáo tài chính';
  for (const range of FINANCE_RANGE_7D_CANDIDATES) {
    const r = await getFinanceReport({ range, groupBy: 'day' });
    if (r.ok) return r;
    lastMessage = r.message;
  }
  return { ok: false, message: lastMessage };
}
