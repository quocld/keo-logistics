/**
 * GET /analytics/dashboard/summary — owner (range=today|…)
 * Field names align with Postman + optional backend variants.
 */
export type AnalyticsFleetStatus = {
  total?: number;
  totalVehicles?: number;
  vehiclesTotalCount?: number;
  active?: number;
  activeCount?: number;
  vehiclesActiveCount?: number;
  onRoadCount?: number;
  running?: number;
  maintenance?: number;
  maintenanceCount?: number;
  idle?: number;
  idleCount?: number;
  offDuty?: number;
  [key: string]: unknown;
};

export type AnalyticsTopDriver = {
  driverId?: number | string;
  userId?: number | string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  name?: string | null;
  revenue?: number | null;
  deliveries?: number | null;
  tripCount?: number | null;
  rating?: number | null;
  ratingAverage?: number | null;
  tier?: string | null;
  tierName?: string | null;
  [key: string]: unknown;
};

export type OwnerDashboardSummary = {
  revenue?: number | null;
  totalRevenue?: number | null;
  profit?: number | null;
  totalProfit?: number | null;
  totalWeight?: number | null;
  dailyAvgWeight?: number | null;
  marginPercent?: number | null;
  revenueTrendPercent?: number | null;
  profitTrendPercent?: number | null;
  marginTrendPercent?: number | null;
  transportGrowthPercent30d?: number | null;
  fleetStatus?: AnalyticsFleetStatus | null;
  topDrivers?: AnalyticsTopDriver[] | null;
  [key: string]: unknown;
};

/** GET /analytics/reports/finance — buckets vary by backend */
export type FinanceReportBucket = {
  date?: string | null;
  bucketDate?: string | null;
  period?: string | null;
  label?: string | null;
  revenue?: number | null;
  totalRevenue?: number | null;
  revenueSum?: number | null;
  profit?: number | null;
  amount?: number | null;
  costDriverSum?: number | null;
  costHarvestSum?: number | null;
  otherCostSum?: number | null;
  operatingCostSum?: number | null;
  [key: string]: unknown;
};

export type FinanceReportResponse = {
  data?: FinanceReportBucket[] | null;
  series?: FinanceReportBucket[] | null;
  buckets?: FinanceReportBucket[] | null;
  [key: string]: unknown;
};
