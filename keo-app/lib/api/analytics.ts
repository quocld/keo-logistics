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
  from?: string;
  to?: string;
}): Promise<FinanceReportResult> {
  const qs = buildQuery({ range: params.range, groupBy: params.groupBy, from: params.from, to: params.to });
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

/** Lấy báo cáo tài chính 7 ngày gần nhất (custom range: từ 6 ngày trước đến hôm nay). */
export function getFinanceReportLast7Days(): Promise<FinanceReportResult> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  return getFinanceReport({
    range: 'custom',
    groupBy: 'day',
    from: from.toISOString(),
    to: to.toISOString(),
  });
}
