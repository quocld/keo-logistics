import type {
  HarvestArea,
  HarvestAreaCreatePayload,
  HarvestAreaUpdatePayload,
  OwnerDriverUser,
  PaginatedList,
  Receipt,
} from '@/lib/types/ops';

import { apiFetch, apiFetchJson } from './client';
import { formatApiErrorFromJsonText, formatApiErrorPayload } from './errors';
import { buildListQuery } from './list-query';
import type { ListReceiptsResult } from './receipts';

export async function listHarvestAreas(params: {
  page: number;
  limit: number;
  filters?: Record<string, unknown>;
}): Promise<PaginatedList<HarvestArea>> {
  const qs = buildListQuery(params);
  return apiFetchJson<PaginatedList<HarvestArea>>(`/harvest-areas?${qs}`);
}

export async function getHarvestArea(id: string | number): Promise<HarvestArea> {
  return apiFetchJson<HarvestArea>(`/harvest-areas/${encodeURIComponent(String(id))}`);
}

export async function createHarvestArea(
  body: HarvestAreaCreatePayload,
): Promise<HarvestArea> {
  return apiFetchJson<HarvestArea>('/harvest-areas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateHarvestArea(
  id: string | number,
  body: HarvestAreaUpdatePayload,
): Promise<HarvestArea> {
  return apiFetchJson<HarvestArea>(`/harvest-areas/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteHarvestArea(id: string | number): Promise<void> {
  await apiFetchJson<Record<string, unknown>>(
    `/harvest-areas/${encodeURIComponent(String(id))}`,
    { method: 'DELETE' },
  );
}

// ---------------------------------------------------------------------------
// Sub-resource: receipts per harvest area
// ---------------------------------------------------------------------------

export type HarvestAreaReceiptSummary = {
  approvedCount: number;
  approvedTotalWeight: number;
  approvedTotalAmount: number;
  pendingCount: number;
  totalCount: number;
};

export async function listHarvestAreaReceipts(
  harvestAreaId: string | number,
  params: {
    page: number;
    limit: number;
    status?: string;
    receiptDateFrom?: string;
    receiptDateTo?: string;
  },
): Promise<ListReceiptsResult> {
  const extra: Record<string, string | undefined> = {};
  if (params.status) extra.status = params.status;
  if (params.receiptDateFrom) extra.receiptDateFrom = params.receiptDateFrom;
  if (params.receiptDateTo) extra.receiptDateTo = params.receiptDateTo;
  const qs = buildListQuery({
    page: params.page,
    limit: params.limit,
    extra: Object.keys(extra).length ? extra : undefined,
  });
  const res = await apiFetch(
    `/harvest-areas/${encodeURIComponent(String(harvestAreaId))}/receipts?${qs}`,
  );
  if (res.status === 403) return { ok: false, forbidden: true };
  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        forbidden: false,
        message: formatApiErrorFromJsonText(text, res.statusText, res.status),
      };
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      forbidden: false,
      message: formatApiErrorPayload(parsed, res.statusText, res.status),
    };
  }
  return { ok: true, body: parsed as PaginatedList<Receipt> };
}

export async function getHarvestAreaReceiptSummary(
  id: string | number,
): Promise<HarvestAreaReceiptSummary> {
  return apiFetchJson<HarvestAreaReceiptSummary>(
    `/harvest-areas/${encodeURIComponent(String(id))}/receipt-summary`,
  );
}

// ---------------------------------------------------------------------------
// Sub-resource: drivers assigned to a harvest area
// ---------------------------------------------------------------------------

export async function getHarvestAreaDrivers(
  id: string | number,
): Promise<OwnerDriverUser[]> {
  return apiFetchJson<OwnerDriverUser[]>(
    `/harvest-areas/${encodeURIComponent(String(id))}/drivers`,
  );
}
