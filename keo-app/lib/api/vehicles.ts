import type { PaginatedList, Vehicle, VehicleCreatePayload, VehicleExpense, VehicleExpenseCreatePayload } from '@/lib/types/ops';

import { apiFetchJson } from './client';
import { buildListQuery } from './list-query';

export async function listVehicles(params: {
  page: number;
  limit: number;
  filters?: Record<string, unknown>;
}): Promise<PaginatedList<Vehicle>> {
  const qs = buildListQuery(params);
  return apiFetchJson<PaginatedList<Vehicle>>(`/vehicles?${qs}`);
}

export async function getVehicle(id: string | number): Promise<Vehicle> {
  return apiFetchJson<Vehicle>(`/vehicles/${encodeURIComponent(String(id))}`);
}

export async function createVehicle(body: VehicleCreatePayload): Promise<Vehicle> {
  return apiFetchJson<Vehicle>('/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function listVehicleExpenses(
  vehicleId: string | number,
  params: { page: number; limit: number },
): Promise<PaginatedList<VehicleExpense>> {
  const qs = buildListQuery(params);
  return apiFetchJson<PaginatedList<VehicleExpense>>(
    `/vehicles/${encodeURIComponent(String(vehicleId))}/expenses?${qs}`,
  );
}

export async function createVehicleExpense(
  vehicleId: string | number,
  body: VehicleExpenseCreatePayload,
): Promise<VehicleExpense> {
  return apiFetchJson<VehicleExpense>(`/vehicles/${encodeURIComponent(String(vehicleId))}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

