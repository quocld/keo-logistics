import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiFetch } from '@/lib/api/client';
import { DRIVER_LOCATION_QUEUE_KEY } from '@/lib/tracking/storage-keys';

const MAX_QUEUE = 50;

/**
 * Body cho `POST /trips/:id/locations` và `POST /drivers/me/location` (KeoTram Ops Postman — Tracking / Locations).
 * Response 204 No Content khi thành công.
 */
export type DriverLocationPingBody = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: string;
};

export type DriverTripLocationPayload = DriverLocationPingBody & {
  tripId: string | number;
};

type QueuedPayload = DriverTripLocationPayload;

function pingBody(p: DriverLocationPingBody): Record<string, unknown> {
  const b: Record<string, unknown> = {
    latitude: p.latitude,
    longitude: p.longitude,
    timestamp: p.timestamp,
  };
  if (p.accuracy != null) b.accuracy = p.accuracy;
  if (p.speed != null) b.speed = p.speed;
  return b;
}

function migrateQueuedItem(raw: unknown): QueuedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.tripId == null) return null;
  const lat = o.latitude;
  const lng = o.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const timestamp =
    typeof o.timestamp === 'string'
      ? o.timestamp
      : typeof o.recordedAt === 'string'
        ? o.recordedAt
        : null;
  if (!timestamp) return null;
  return {
    tripId: o.tripId as string | number,
    latitude: lat,
    longitude: lng,
    accuracy: o.accuracy == null ? null : Number(o.accuracy),
    speed: o.speed == null ? null : Number(o.speed),
    timestamp,
  };
}

async function readQueue(): Promise<QueuedPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_LOCATION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: QueuedPayload[] = [];
    for (const item of parsed) {
      const n = migrateQueuedItem(item);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedPayload[]): Promise<void> {
  const trimmed = items.slice(-MAX_QUEUE);
  await AsyncStorage.setItem(DRIVER_LOCATION_QUEUE_KEY, JSON.stringify(trimmed));
}

async function enqueue(payload: QueuedPayload): Promise<void> {
  const q = await readQueue();
  q.push(payload);
  await writeQueue(q);
}

/**
 * Tài xế ping khi không trong trip (Postman: POST /drivers/me/location → 204).
 */
export async function postDriverMeLocation(body: DriverLocationPingBody): Promise<void> {
  const res = await apiFetch('/drivers/me/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pingBody(body)),
  });
  if (!res.ok) {
    throw new Error(`POST /drivers/me/location failed: ${res.status}`);
  }
}

/**
 * Ping trong trip `in_progress` (Postman: POST /trips/:id/locations → 204).
 * Lỗi mạng / 5xx → enqueue để flush sau.
 */
export async function postDriverLocationSample(payload: DriverTripLocationPayload): Promise<void> {
  const path = `/trips/${encodeURIComponent(String(payload.tripId))}/locations`;

  try {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pingBody(payload)),
    });

    if (res.ok) {
      return;
    }

    await enqueue(payload);
  } catch {
    await enqueue(payload);
  }
}

export async function flushLocationQueue(): Promise<void> {
  let q = await readQueue();
  if (q.length === 0) return;

  const remaining: QueuedPayload[] = [];

  for (const item of q) {
    const path = `/trips/${encodeURIComponent(String(item.tripId))}/locations`;
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pingBody(item)),
      });
      if (!res.ok) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
}
