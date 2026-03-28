import type {
  OwnerDriverCreatePayload,
  OwnerDriverUpdatePayload,
  OwnerDriverUser,
  PaginatedList,
} from '@/lib/types/ops';

import { apiFetchJson } from './client';
import { buildListQuery } from './list-query';

export async function createOwnerDriver(body: OwnerDriverCreatePayload): Promise<OwnerDriverUser> {
  return apiFetchJson<OwnerDriverUser>('/owner/drivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function listOwnerDrivers(params: {
  page: number;
  limit: number;
}): Promise<PaginatedList<OwnerDriverUser>> {
  const qs = buildListQuery(params);
  return apiFetchJson<PaginatedList<OwnerDriverUser>>(`/owner/drivers?${qs}`);
}

export async function getOwnerDriver(id: string | number): Promise<OwnerDriverUser> {
  return apiFetchJson<OwnerDriverUser>(`/owner/drivers/${encodeURIComponent(String(id))}`);
}

export async function updateOwnerDriver(
  id: string | number,
  body: OwnerDriverUpdatePayload,
): Promise<OwnerDriverUser> {
  return apiFetchJson<OwnerDriverUser>(`/owner/drivers/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteOwnerDriver(id: string | number): Promise<void> {
  await apiFetchJson<Record<string, unknown>>(`/owner/drivers/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}
