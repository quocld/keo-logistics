import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { DRIVER_LOCATION_TASK_NAME } from './driver-location-task-name';
import { clearLastSentTimestamp, setLocationTaskTripId } from './driver-trip-storage';

export async function ensureForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function ensureBackgroundPermission(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return false;
  }
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function isTrackingRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK_NAME);
}

/** Idempotent: dùng khi bật GPS hoặc khôi phục sau mở lại app. */
export async function resumeDriverTrackingIfNeeded(
  tripId: string,
): Promise<{ ok: boolean; message?: string }> {
  const fg = await ensureForegroundPermission();
  if (!fg) {
    return { ok: false, message: 'Cần quyền vị trí khi đang dùng app để bật theo dõi GPS.' };
  }
  const bg = await ensureBackgroundPermission();
  if (!bg) {
    return { ok: false, message: 'Cần quyền vị trí luôn luôn để theo dõi khi app ở nền.' };
  }
  const running = await isTrackingRunning();
  if (!running) {
    await startTrackingUpdates(tripId);
  }
  return { ok: true };
}

export async function startTrackingUpdates(tripId: string): Promise<void> {
  await setLocationTaskTripId(tripId);
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 75,
    timeInterval: 30_000,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'KeoTram — đang theo dõi chuyến',
      notificationBody: 'Vị trí được gửi để chủ vườn theo dõi vận chuyển.',
      notificationColor: '#1B5E20',
    },
    pausesUpdatesAutomatically: Platform.OS === 'ios',
  });
}

export async function stopTrackingUpdates(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK_NAME);
  }
  await setLocationTaskTripId(null);
  await clearLastSentTimestamp();
}
