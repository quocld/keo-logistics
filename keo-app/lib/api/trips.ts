import type {
  AggregatedDriver,
  PaginatedList,
  Trip,
  TripCreatePayload,
  TripDriverRef,
} from '@/lib/types/ops';

import { apiFetchJson } from './client';
import { buildListQuery } from './list-query';

export async function listTrips(params: {
  page: number;
  limit: number;
  status?: string;
  /** Query trực tiếp — API Ops (admin); owner theo khu sở hữu */
  harvestAreaId?: string | number;
}): Promise<PaginatedList<Trip>> {
  const extra: Record<string, string | undefined> = {};
  if (params.status) extra.status = params.status;
  if (params.harvestAreaId != null && params.harvestAreaId !== '') {
    extra.harvestAreaId = String(params.harvestAreaId);
  }
  const qs = buildListQuery({
    page: params.page,
    limit: params.limit,
    extra: Object.keys(extra).length ? extra : undefined,
  });
  return apiFetchJson<PaginatedList<Trip>>(`/trips?${qs}`);
}

export async function fetchMyInProgressTrip(): Promise<Trip | null> {
  const res = await listTrips({ page: 1, limit: 5, status: 'in_progress' });
  return res.data[0] ?? null;
}

/** Chuyến cần hiển thị cho tài xế: ưu tiên in_progress, sau đó planned. */
export async function fetchMyActiveTrip(): Promise<Trip | null> {
  const res = await listTrips({ page: 1, limit: 25 });
  const inProg = res.data.find((t) => t.status === 'in_progress');
  if (inProg) return inProg;
  return res.data.find((t) => t.status === 'planned') ?? null;
}

export async function createTrip(body: TripCreatePayload): Promise<Trip> {
  return apiFetchJson<Trip>('/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function startTripById(id: string | number): Promise<Trip> {
  return apiFetchJson<Trip>(`/trips/${encodeURIComponent(String(id))}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function completeTrip(id: string | number): Promise<Trip> {
  return apiFetchJson<Trip>(`/trips/${encodeURIComponent(String(id))}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function cancelTrip(id: string | number): Promise<Trip> {
  return apiFetchJson<Trip>(`/trips/${encodeURIComponent(String(id))}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

function driverRef(trip: Trip): TripDriverRef | null {
  if (trip.driver && typeof trip.driver === 'object') {
    return trip.driver;
  }
  return null;
}

function driverKey(trip: Trip): string | null {
  const ref = driverRef(trip);
  if (ref?.id != null) {
    return `id:${ref.id}`;
  }
  if (trip.driverId != null && trip.driverId !== '') {
    return `id:${trip.driverId}`;
  }
  return null;
}

function displayName(ref: TripDriverRef | null, trip: Trip): string {
  if (ref) {
    const parts = [ref.firstName, ref.lastName].filter(Boolean);
    if (parts.length) {
      return parts.join(' ');
    }
    if (ref.email) {
      return ref.email;
    }
  }
  if (trip.driverId != null && trip.driverId !== '') {
    return `Tài xế #${trip.driverId}`;
  }
  return 'Tài xế (chưa rõ)';
}

/** Merge trips into unique drivers; `trips` should be newest-first per page merge order. */
export async function fetchTripsForDriverAggregation(params: {
  limitPerPage: number;
  maxPages: number;
  status?: string;
}): Promise<Trip[]> {
  const all: Trip[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= params.maxPages) {
    const res = await listTrips({
      page,
      limit: params.limitPerPage,
      status: params.status,
    });
    all.push(...res.data);
    hasNext = res.hasNextPage;
    page += 1;
  }
  return all;
}

export function aggregateDriversFromTrips(trips: Trip[]): AggregatedDriver[] {
  const map = new Map<string, AggregatedDriver>();

  for (const t of trips) {
    const key = driverKey(t);
    if (!key) {
      continue;
    }
    const ref = driverRef(t);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        driverId: ref?.id ?? t.driverId ?? key,
        displayName: displayName(ref, t),
        email: ref?.email,
        tripCount: 1,
        lastStatus: t.status,
        lastTripId: t.id,
        lastUpdated: t.updatedAt ?? t.createdAt,
      });
    } else {
      existing.tripCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.tripCount - a.tripCount);
}
