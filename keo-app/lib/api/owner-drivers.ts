import type {
  HarvestArea,
  OwnerDriverCreatePayload,
  OwnerDriverHarvestAreasPayload,
  OwnerDriverUpdatePayload,
  OwnerDriverUser,
  PaginatedList,
  Vehicle,
} from '@/lib/types/ops';

import { apiFetch, apiFetchJson } from './client';
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

export type OwnerDriverVehicleResult =
  | { ok: true; vehicle: Vehicle }
  | { ok: true; vehicle: null }
  | { ok: false; message: string };

export async function getOwnerDriverVehicle(driverId: string | number): Promise<OwnerDriverVehicleResult> {
  const res = await apiFetch(`/owner/drivers/${encodeURIComponent(String(driverId))}/vehicle`);
  if (res.status === 204) return { ok: true, vehicle: null };
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, message: text.trim().slice(0, 300) || res.statusText };
  }
  if (!text) return { ok: true, vehicle: null };
  try {
    return { ok: true, vehicle: JSON.parse(text) as Vehicle };
  } catch {
    return { ok: false, message: text.trim().slice(0, 300) || 'Phản hồi không hợp lệ' };
  }
}

export async function setOwnerDriverVehicle(
  driverId: string | number,
  body: { vehicleId: string | number | null },
): Promise<void> {
  await apiFetchJson<Record<string, unknown>>(
    `/owner/drivers/${encodeURIComponent(String(driverId))}/vehicle`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

/** Lấy toàn bộ managed drivers (phân trang tới khi hết hoặc tối đa maxPages). */
export async function listAllOwnerDrivers(options?: {
  pageSize?: number;
  maxPages?: number;
}): Promise<OwnerDriverUser[]> {
  const pageSize = options?.pageSize ?? 50;
  const maxPages = options?.maxPages ?? 20;
  const all: OwnerDriverUser[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= maxPages) {
    const res = await listOwnerDrivers({ page, limit: pageSize });
    all.push(...res.data);
    hasNext = res.hasNextPage;
    page += 1;
  }
  return all;
}

function parseDriverHarvestAreasJson(json: unknown): HarvestArea[] {
  if (Array.isArray(json)) {
    return json as HarvestArea[];
  }
  if (
    json &&
    typeof json === 'object' &&
    'data' in json &&
    Array.isArray((json as { data: unknown }).data)
  ) {
    return (json as { data: HarvestArea[] }).data;
  }
  return [];
}

export async function getOwnerDriverHarvestAreas(driverId: string | number): Promise<HarvestArea[]> {
  const json = await apiFetchJson<unknown>(
    `/owner/drivers/${encodeURIComponent(String(driverId))}/harvest-areas`,
  );
  return parseDriverHarvestAreasJson(json);
}

export async function setOwnerDriverHarvestAreas(
  driverId: string | number,
  body: OwnerDriverHarvestAreasPayload,
): Promise<void> {
  await apiFetchJson<Record<string, unknown>>(
    `/owner/drivers/${encodeURIComponent(String(driverId))}/harvest-areas`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

/** Thêm một bãi vào gán hiện có (PUT merge). */
export async function appendHarvestAreaForOwnerDriver(
  driverId: string | number,
  harvestAreaId: string | number,
): Promise<void> {
  const current = await getOwnerDriverHarvestAreas(driverId);
  const ids = current.map((a) => a.id);
  const h = String(harvestAreaId);
  if (ids.some((x) => String(x) === h)) return;
  await setOwnerDriverHarvestAreas(driverId, { harvestAreaIds: [...ids, harvestAreaId] });
}

/** Bỏ một bãi khỏi gán hiện có. */
export async function removeHarvestAreaFromOwnerDriver(
  driverId: string | number,
  harvestAreaId: string | number,
): Promise<void> {
  const current = await getOwnerDriverHarvestAreas(driverId);
  const h = String(harvestAreaId);
  const next = current.map((a) => a.id).filter((x) => String(x) !== h);
  await setOwnerDriverHarvestAreas(driverId, { harvestAreaIds: next });
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
