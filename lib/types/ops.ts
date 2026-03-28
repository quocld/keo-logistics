/** Confirmed from GET /harvest-areas (admin) on Railway — empty list shape. */
export type PaginatedList<T> = {
  data: T[];
  hasNextPage: boolean;
};

export type HarvestAreaStatus =
  | 'inactive'
  | 'preparing'
  | 'active'
  | 'paused'
  | 'awaiting_renewal'
  | 'completed';

export type HarvestArea = {
  id: string | number;
  name: string;
  status: HarvestAreaStatus | string;
  areaHectares?: number | null;
  targetTons?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string | null;
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  siteContactEmail?: string | null;
  sitePurchaseDate?: string | null;
  siteNotes?: string | null;
  ownerId?: number | null;
  [key: string]: unknown;
};

/** POST /harvest-areas — owner (không gửi ownerId). Admin gửi thêm ownerId. */
export type HarvestAreaCreatePayload = {
  name: string;
  status: HarvestAreaStatus;
  areaHectares?: number | null;
  targetTons?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string | null;
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  siteContactEmail?: string | null;
  sitePurchaseDate?: string | null;
  siteNotes?: string | null;
  ownerId?: number;
};

export type HarvestAreaUpdatePayload = Partial<
  Omit<HarvestAreaCreatePayload, 'ownerId'>
> & { ownerId?: number };

export type WeighingStation = {
  id: string | number;
  name: string;
  code?: string;
  unitPrice?: number;
  status?: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type TripDriverRef = {
  id?: number;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type Trip = {
  id: string | number;
  status: string;
  driver?: TripDriverRef | null;
  driverId?: number | string | null;
  harvestAreaId?: string | number;
  weighingStationId?: string | number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type AggregatedDriver = {
  key: string;
  driverId: number | string;
  displayName: string;
  email?: string;
  tripCount: number;
  lastStatus: string;
  lastTripId: string | number;
  lastUpdated?: string;
};
