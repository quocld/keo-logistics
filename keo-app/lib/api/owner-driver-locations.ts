import type { PaginatedList } from '@/lib/types/ops';

import { apiFetchJson } from './client';

/**
 * GET /owner/drivers/locations/latest — last-known cho managed drivers (Postman: Tracking / Locations).
 * Cấu trúc từng phần tử phụ thuộc backend; bổ sung field khi contract cố định.
 */
export type OwnerDriverLatestLocation = {
  driverId?: string | number;
  driverUserId?: string | number;
  userId?: string | number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  speed?: number | null;
  timestamp?: string;
  /** Resolved profile image: string URL or `{ id, path }` from API */
  photo?: string | { id?: string; path?: string } | null;
  avatarUrl?: string | null;
  /** Giống user profile: preset trong app khi `false`. */
  isCustomAvatar?: boolean | null;
  appAvatar?: string | null;
  [key: string]: unknown;
};

/** Bản ghi đã gán được cặp tọa độ số (map / polling). */
export type NormalizedOwnerDriverLatestLocation = OwnerDriverLatestLocation & {
  latitude: number;
  longitude: number;
};

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Backend có thể trả tọa độ phẳng, nested (`location`, …), hoặc GeoJSON `coordinates: [lng, lat]`.
 */
export function normalizeOwnerDriverLatestRow(
  loc: OwnerDriverLatestLocation,
): NormalizedOwnerDriverLatestLocation | null {
  const row = loc as Record<string, unknown>;

  const directLat = toFiniteNumber(row.latitude) ?? toFiniteNumber(row.lat);
  const directLng =
    toFiniteNumber(row.longitude) ?? toFiniteNumber(row.lng) ?? toFiniteNumber(row.lon);
  if (directLat != null && directLng != null) {
    return { ...loc, latitude: directLat, longitude: directLng };
  }

  const nestedKeys = ['location', 'lastLocation', 'position', 'point', 'coords', 'coordinate'];
  for (const k of nestedKeys) {
    const n = row[k];
    if (n && typeof n === 'object' && !Array.isArray(n)) {
      const o = n as Record<string, unknown>;
      const lat = toFiniteNumber(o.latitude) ?? toFiniteNumber(o.lat);
      const lng =
        toFiniteNumber(o.longitude) ?? toFiniteNumber(o.lng) ?? toFiniteNumber(o.lon);
      if (lat != null && lng != null) {
        return { ...loc, latitude: lat, longitude: lng };
      }
    }
  }

  const coords = row.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = toFiniteNumber(coords[0]);
    const lat = toFiniteNumber(coords[1]);
    if (lat != null && lng != null) {
      return { ...loc, latitude: lat, longitude: lng };
    }
  }

  return null;
}

export async function fetchOwnerDriversLocationsLatest(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedList<OwnerDriverLatestLocation>> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 200;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiFetchJson<PaginatedList<OwnerDriverLatestLocation>>(
    `/owner/drivers/locations/latest?${qs.toString()}`,
  );
}
