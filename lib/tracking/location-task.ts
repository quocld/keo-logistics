import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { postDriverLocationSample, flushLocationQueue } from '@/lib/api/driver-location';

import { DRIVER_LOCATION_TASK_NAME } from './driver-location-task-name';
import {
  getLastSentTimestampMs,
  getLocationTaskTripId,
  setLastSentTimestampMs,
} from './driver-trip-storage';

const ACCURACY_MAX_M = 80;
const MIN_SEND_INTERVAL_MS = 15_000;

TaskManager.defineTask(DRIVER_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (__DEV__) {
      console.warn('[location-task]', error);
    }
    return;
  }
  if (!data) return;

  const { locations } = data as { locations?: Location.LocationObject[] };
  const loc = locations?.[0];
  if (!loc?.coords) return;

  const acc = loc.coords.accuracy;
  if (acc != null && acc > ACCURACY_MAX_M) {
    return;
  }

  const tripId = await getLocationTaskTripId();
  if (!tripId) return;

  const now = Date.now();
  const last = await getLastSentTimestampMs();
  if (now - last < MIN_SEND_INTERVAL_MS) {
    return;
  }

  await flushLocationQueue();

  await postDriverLocationSample({
    tripId,
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    speed: loc.coords.speed ?? null,
    timestamp: new Date(loc.timestamp).toISOString(),
  });

  await setLastSentTimestampMs(now);
});
