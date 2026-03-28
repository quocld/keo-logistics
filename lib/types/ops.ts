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
  ownerId?: number | null;
  /** Khi backend trả thống kê theo tháng */
  monthlyWeighCount?: number | null;
  expectedMonthlyRevenue?: number | null;
  [key: string]: unknown;
};

/** POST /weighing-stations (owner | admin theo API) */
export type WeighingStationCreatePayload = {
  name: string;
  code?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string | null;
  unitPrice?: number;
  status?: string;
  notes?: string | null;
  ownerId?: number;
};

export type WeighingStationUpdatePayload = Partial<
  Omit<WeighingStationCreatePayload, 'ownerId'>
> & { ownerId?: number };

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

/** POST /users (Admin) — KeoTram Ops Postman */
export type UserCreatePayload = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: { id: number };
  status?: { id: number };
  managedByOwnerId?: number;
};

/** POST /owner/drivers (Owner) — role = driver implicit; managedByOwner = caller */
export type OwnerDriverCreatePayload = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  status?: { id: number };
};

export type OwnerDriverUpdatePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

export type OwnerDriverUser = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: { id: number; name?: string };
  status?: { id: number; name?: string } | null;
  managedByOwnerId?: number | null;
  [key: string]: unknown;
};
