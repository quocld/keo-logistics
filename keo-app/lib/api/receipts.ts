import type {
  PaginatedList,
  Receipt,
  ReceiptApprovePayload,
  ReceiptCreatePayload,
  ReceiptRejectPayload,
} from '@/lib/types/ops';

import { apiFetch, apiFetchJson } from './client';
import { formatApiErrorFromJsonText, formatApiErrorPayload } from './errors';
import { buildListQuery } from './list-query';

export type ListReceiptsResult =
  | { ok: true; body: PaginatedList<Receipt> }
  | { ok: false; forbidden: true }
  | { ok: false; forbidden: false; message: string };

export async function listReceipts(params: {
  page: number;
  limit: number;
  status?: string;
  harvestAreaId?: string | number;
  receiptDateFrom?: string;
  receiptDateTo?: string;
}): Promise<ListReceiptsResult> {
  const extra: Record<string, string | undefined> = {};
  if (params.status) extra.status = params.status;
  if (params.harvestAreaId != null && params.harvestAreaId !== '') {
    extra.harvestAreaId = String(params.harvestAreaId);
  }
  if (params.receiptDateFrom) extra.receiptDateFrom = params.receiptDateFrom;
  if (params.receiptDateTo) extra.receiptDateTo = params.receiptDateTo;
  const qs = buildListQuery({
    page: params.page,
    limit: params.limit,
    extra: Object.keys(extra).length ? extra : undefined,
  });
  const res = await apiFetch(`/receipts?${qs}`);

  if (res.status === 403) {
    return { ok: false, forbidden: true };
  }

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

export async function getReceipt(id: string | number): Promise<Receipt> {
  return apiFetchJson<Receipt>(`/receipts/${encodeURIComponent(String(id))}`);
}

export async function createReceipt(body: ReceiptCreatePayload): Promise<Receipt> {
  return apiFetchJson<Receipt>('/receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function approveReceipt(
  id: string | number,
  body?: ReceiptApprovePayload,
): Promise<Receipt> {
  return apiFetchJson<Receipt>(`/receipts/${encodeURIComponent(String(id))}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export async function rejectReceipt(id: string | number, body?: ReceiptRejectPayload): Promise<Receipt> {
  return apiFetchJson<Receipt>(`/receipts/${encodeURIComponent(String(id))}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}
