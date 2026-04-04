import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  registerExpoPushDevice,
  type ExpoPushPlatform,
  type RegisterExpoPushBody,
} from '@/lib/api/notifications';

const STORAGE_KEY = 'keotram_expo_push_registration';

type StoredRegistration = {
  expoPushToken: string;
  platform: ExpoPushPlatform;
};

let androidChannelReady = false;

function getEasProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) {
    return;
  }
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  androidChannelReady = true;
}

async function readStoredRegistration(): Promise<StoredRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRegistration;
    if (
      typeof parsed?.expoPushToken !== 'string' ||
      (parsed.platform !== 'ios' && parsed.platform !== 'android')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredRegistration(reg: StoredRegistration | null): Promise<void> {
  if (!reg) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reg));
}

/**
 * Đăng ký Expo push token với backend sau khi user đã đăng nhập.
 * Best-effort: không throw; bỏ qua web, simulator, thiếu quyền, hoặc thiếu EAS projectId.
 */
export async function registerPushForCurrentSession(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  if (!Device.isDevice) {
    return;
  }

  try {
    await ensureAndroidNotificationChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.status === 'granted';
    }
    if (!granted) {
      return;
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      console.warn(
        '[push] Missing EAS projectId (extra.eas.projectId). Push token unavailable until configured.',
      );
      return;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenRes.data;
    if (!expoPushToken) {
      return;
    }

    const platform: ExpoPushPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
    const easEnvironment = process.env.EXPO_PUBLIC_EAS_ENV?.trim() || undefined;

    const body: RegisterExpoPushBody = {
      expoPushToken,
      platform,
      enabled: true,
      easProjectId: projectId,
      ...(easEnvironment ? { easEnvironment } : {}),
    };

    await registerExpoPushDevice(body);
    await writeStoredRegistration({ expoPushToken, platform });
  } catch (e) {
    console.warn('[push] registerPushForCurrentSession failed', e);
  }
}

/**
 * Gửi enabled: false với token đã lưu (best-effort) trước khi xóa session.
 */
export async function unregisterPushBestEffort(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const stored = await readStoredRegistration();
    if (!stored) {
      return;
    }

    const projectId = getEasProjectId();
    const easEnvironment = process.env.EXPO_PUBLIC_EAS_ENV?.trim() || undefined;

    await registerExpoPushDevice({
      expoPushToken: stored.expoPushToken,
      platform: stored.platform,
      enabled: false,
      ...(projectId ? { easProjectId: projectId } : {}),
      ...(easEnvironment ? { easEnvironment } : {}),
    });
  } catch (e) {
    console.warn('[push] unregisterPushBestEffort failed', e);
  } finally {
    try {
      await writeStoredRegistration(null);
    } catch {
      /* ignore */
    }
  }
}
