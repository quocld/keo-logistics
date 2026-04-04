import {
  DEFAULT_APP_AVATAR_FOR_NEW_DRIVER,
  getAppAvatarSource,
  type AppAvatarKey,
} from '@/constants/app-avatars';
import type { AuthUser } from '@/lib/auth/types';

export type AvatarPickerValue = {
  mode: 'preset' | 'custom';
  appAvatarKey: AppAvatarKey;
  /** Ảnh máy đã chọn, chưa upload (khi mode === 'custom'). */
  pendingFile: { uri: string; name: string; mimeType: string } | null;
};

export function defaultAvatarPickerValue(
  initialPreset: AppAvatarKey = DEFAULT_APP_AVATAR_FOR_NEW_DRIVER,
): AvatarPickerValue {
  return { mode: 'preset', appAvatarKey: initialPreset, pendingFile: null };
}

export function avatarPickerValueFromUser(user: AuthUser | null): AvatarPickerValue {
  if (!user) return defaultAvatarPickerValue();
  if (user.isCustomAvatar === true) {
    return {
      mode: 'custom',
      appAvatarKey: DEFAULT_APP_AVATAR_FOR_NEW_DRIVER,
      pendingFile: null,
    };
  }
  const key = user.appAvatar && getAppAvatarSource(user.appAvatar) ? (user.appAvatar as AppAvatarKey) : null;
  return {
    mode: 'preset',
    appAvatarKey: key ?? DEFAULT_APP_AVATAR_FOR_NEW_DRIVER,
    pendingFile: null,
  };
}
