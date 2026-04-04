import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { DRIVER_LOCATION_QUEUE_KEY } from '@/lib/tracking/storage-keys';

const SECURE_DRIVER_TRIP = 'keo_driver_trip_persist_v1';
const ASYNC_TRIP_ID_FOR_TASK = 'keo_driver_location_trip_id';
const ASYNC_LAST_SENT_MS = 'keo_driver_location_last_sent_ms';

export type PersistedDriverTrip = {
  activeTripId: string;
  trackingDesired: boolean;
};

export async function savePersistedDriverTrip(state: PersistedDriverTrip | null): Promise<void> {
  if (!state) {
    await SecureStore.deleteItemAsync(SECURE_DRIVER_TRIP);
    return;
  }
  await SecureStore.setItemAsync(SECURE_DRIVER_TRIP, JSON.stringify(state));
}

export async function loadPersistedDriverTrip(): Promise<PersistedDriverTrip | null> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_DRIVER_TRIP);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedDriverTrip;
    if (!p?.activeTripId || typeof p.trackingDesired !== 'boolean') return null;
    return p;
  } catch {
    return null;
  }
}

export async function setLocationTaskTripId(tripId: string | null): Promise<void> {
  if (tripId) {
    await AsyncStorage.setItem(ASYNC_TRIP_ID_FOR_TASK, tripId);
  } else {
    await AsyncStorage.removeItem(ASYNC_TRIP_ID_FOR_TASK);
  }
}

export async function getLocationTaskTripId(): Promise<string | null> {
  return AsyncStorage.getItem(ASYNC_TRIP_ID_FOR_TASK);
}

export async function getLastSentTimestampMs(): Promise<number> {
  const v = await AsyncStorage.getItem(ASYNC_LAST_SENT_MS);
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function setLastSentTimestampMs(ts: number): Promise<void> {
  await AsyncStorage.setItem(ASYNC_LAST_SENT_MS, String(ts));
}

export async function clearLastSentTimestamp(): Promise<void> {
  await AsyncStorage.removeItem(ASYNC_LAST_SENT_MS);
}

export async function clearDriverTripPersistence(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_DRIVER_TRIP);
  await AsyncStorage.multiRemove([
    ASYNC_TRIP_ID_FOR_TASK,
    ASYNC_LAST_SENT_MS,
    DRIVER_LOCATION_QUEUE_KEY,
  ]);
}
