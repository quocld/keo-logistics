import type { PaginatedList, WeighingStation } from '@/lib/types/ops';

import { apiFetch } from './client';
import { buildListQuery } from './list-query';

export type ListWeighingStationsResult =
  | { ok: true; body: PaginatedList<WeighingStation> }
  | { ok: false; forbidden: true }
  | { ok: false; forbidden: false; message: string };

export async function listWeighingStations(params: {
  page: number;
  limit: number;
  filters?: Record<string, unknown>;
}): Promise<ListWeighingStationsResult> {
  const qs = buildListQuery(params);
  const res = await apiFetch(`/weighing-stations?${qs}`);

  if (res.status === 403) {
    return { ok: false, forbidden: true };
  }

  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, forbidden: false, message: text.slice(0, 200) || res.statusText };
    }
  }

  if (!res.ok) {
    const msg = (parsed as { message?: string }).message ?? res.statusText;
    return { ok: false, forbidden: false, message: typeof msg === 'string' ? msg : 'Request failed' };
  }

  return { ok: true, body: parsed as PaginatedList<WeighingStation> };
}
