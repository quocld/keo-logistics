import type { AggregatedDriver, PaginatedList, Trip, TripDriverRef } from '@/lib/types/ops';

import { apiFetchJson } from './client';
import { buildListQuery } from './list-query';

export async function listTrips(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<PaginatedList<Trip>> {
  const qs = buildListQuery({
    page: params.page,
    limit: params.limit,
    extra: params.status ? { status: params.status } : undefined,
  });
  return apiFetchJson<PaginatedList<Trip>>(`/trips?${qs}`);
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
