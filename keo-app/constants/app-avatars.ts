import { Images } from '@/constants/images';

/**
 * Key gửi lên API field `appAvatar` (PATCH /auth/me, PATCH /users/:id, PATCH /owner/drivers/:id).
 * Khớp 12 ảnh trong `assets/images/default-avatars/`.
 */
export const APP_AVATAR_KEYS = [
  'avatar_01',
  'avatar_02',
  'avatar_03',
  'avatar_04',
  'avatar_05',
  'avatar_06',
  'avatar_07',
  'avatar_08',
  'avatar_09',
  'avatar_10',
  'avatar_11',
  'avatar_12',
] as const;

export type AppAvatarKey = (typeof APP_AVATAR_KEYS)[number];

const SOURCES = Images.defaultAvatars;

export const APP_AVATAR_OPTIONS: ReadonlyArray<{ key: AppAvatarKey; source: (typeof SOURCES)[number] }> =
  APP_AVATAR_KEYS.map((key, i) => ({
    key,
    source: SOURCES[i]!,
  }));

const KEY_TO_SOURCE = new Map<AppAvatarKey, (typeof SOURCES)[number]>(
  APP_AVATAR_OPTIONS.map((o) => [o.key, o.source]),
);

export function getAppAvatarSource(key: string | null | undefined): (typeof SOURCES)[number] | null {
  if (!key || typeof key !== 'string') return null;
  return KEY_TO_SOURCE.get(key as AppAvatarKey) ?? null;
}

/** Gợi ý mặc định khi tạo tài xế (ảnh avatar-02-driver). */
export const DEFAULT_APP_AVATAR_FOR_NEW_DRIVER: AppAvatarKey = 'avatar_02';
