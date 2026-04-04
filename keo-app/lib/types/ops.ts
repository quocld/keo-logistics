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

/** POST /trips — KeoTram Ops Postman (driver) */
export type TripCreatePayload = {
  harvestAreaId: string | number;
  weighingStationId: string | number;
  startNow?: boolean;
  estimatedDistance?: number;
};

/** GET /receipts — shape linh hoạt theo backend Ops */
export type Receipt = {
  id: string | number;
  status?: string;
  weight?: number | null;
  amount?: number | null;
  harvestAreaId?: string | number | null;
  harvestArea?: { id?: number; name?: string } | null;
  driver?: TripDriverRef | null;
  driverId?: number | string | null;
  receiptDate?: string | null;
  billCode?: string | null;
  weighingStationId?: string | number | null;
  imageUrls?: string[] | null;
  /** GET detail/list — ảnh từ DB (S3), mỗi phần tử có imageUrl */
  images?: Array<{ id?: string; imageUrl?: string; isPrimary?: boolean }> | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type ReceiptApprovePayload = {
  weighingStationId?: string | number;
};

export type ReceiptRejectPayload = {
  rejectedReason?: string | null;
};

/** POST /receipts — KeoTram Ops Postman (driver | owner theo quyền API) */
export type ReceiptCreatePayload = {
  /** Bắt buộc khi owner tạo phiếu hộ tài xế (managed); không gửi khi driver tự submit. */
  driverUserId?: string | number;
  harvestAreaId: string | number;
  weighingStationId?: string | number | null;
  tripId?: string | number | null;
  weight: number;
  amount: number;
  receiptDate: string;
  billCode?: string | null;
  notes?: string | null;
  imageUrls?: string[];
  imageFileIds?: string[];
  /** @deprecated ưu tiên imageUrls / imageFileIds */
  receiptImageUrl?: string | null;
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

export type VehicleExpenseType = 'repair' | 'fuel' | 'other';

export type VehicleExpense = {
  id: string | number;
  vehicleId?: string | number;
  expenseType: VehicleExpenseType | string;
  amount: number;
  occurredAt?: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type VehicleExpenseCreatePayload = {
  expenseType: VehicleExpenseType;
  amount: number;
  occurredAt?: string;
  notes?: string | null;
};

export type Vehicle = {
  id: string | number;
  plate: string;
  name?: string | null;
  ownerId?: number | null;
  assignedDriverId?: string | number | null;
  /** When backend returns embedded refs */
  assignedDriver?: TripDriverRef | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type VehicleCreatePayload = {
  plate: string;
  name?: string | null;
  /** Admin-only: create vehicle for owner */
  ownerId?: number;
};

/** GET /owner/vehicles (dự kiến) — UI quản lý phương tiện */
export type OwnerVehicleStatus = 'running' | 'maintenance' | 'idle';

export type OwnerVehicleRow = {
  id: string;
  plate: string;
  modelLabel: string;
  status: OwnerVehicleStatus;
  driverName: string | null;
  driverId: string | number | null;
  capacityTons: number;
  note: string;
};

/** PATCH /users/:id — avatar giống PATCH /auth/me (Postman). */
export type UserUpdatePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  isCustomAvatar?: boolean;
  appAvatar?: string | null;
  photo?: { id: string } | null;
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
  isCustomAvatar?: boolean;
  appAvatar?: string | null;
  photo?: { id: string } | null;
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

/** PUT /owner/drivers/:driverId/harvest-areas — thay thế toàn bộ danh sách gán bãi */
export type OwnerDriverHarvestAreasPayload = {
  harvestAreaIds: (string | number)[];
};

/** GET /notifications — inbox; PATCH /notifications/:id/read cập nhật cùng shape */
export type NotificationInboxItem = {
  id: string;
  isRead: boolean;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  createdAt?: string | null;
  readAt?: string | null;
  [key: string]: unknown;
};
