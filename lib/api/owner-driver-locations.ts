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
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  speed?: number | null;
  timestamp?: string;
  [key: string]: unknown;
};

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
