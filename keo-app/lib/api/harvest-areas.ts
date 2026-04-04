import type {
  HarvestArea,
  HarvestAreaCreatePayload,
  HarvestAreaUpdatePayload,
  PaginatedList,
} from '@/lib/types/ops';

import { apiFetchJson } from './client';
import { buildListQuery } from './list-query';

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
