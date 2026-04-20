import type {
  PaginatedList,
  Receipt,
  WeighingStation,
  WeighingStationCreatePayload,
  WeighingStationUpdatePayload,
} from '@/lib/types/ops';

import { apiFetch, apiFetchJson } from './client';
import { formatApiErrorFromJsonText, formatApiErrorPayload } from './errors';
import { buildListQuery } from './list-query';
import type { ListReceiptsResult } from './receipts';

export async function createWeighingStation(body: WeighingStationCreatePayload): Promise<WeighingStation> {
  return apiFetchJson<WeighingStation>('/weighing-stations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getWeighingStation(id: string | number): Promise<WeighingStation> {
  return apiFetchJson<WeighingStation>(
    `/weighing-stations/${encodeURIComponent(String(id))}`,
  );
}

export async function updateWeighingStation(
  id: string | number,
  body: WeighingStationUpdatePayload,
): Promise<WeighingStation> {
  return apiFetchJson<WeighingStation>(`/weighing-stations/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteWeighingStation(id: string | number): Promise<void> {
  await apiFetchJson<Record<string, unknown>>(
    `/weighing-stations/${encodeURIComponent(String(id))}`,
    { method: 'DELETE' },
  );
}

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

  return { ok: true, body: parsed as PaginatedList<WeighingStation> };
}

export async function listWeighingStationReceipts(
  stationId: string | number,
  params: { page: number; limit: number },
): Promise<ListReceiptsResult> {
  const qs = buildListQuery({ page: params.page, limit: params.limit });
  const res = await apiFetch(
    `/weighing-stations/${encodeURIComponent(String(stationId))}/receipts?${qs}`,
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
