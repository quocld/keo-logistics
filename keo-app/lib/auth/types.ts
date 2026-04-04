import { extractPhotoUrlFromApi } from '@/lib/avatar/extract-photo-url';

export type AppRole = 'admin' | 'owner' | 'driver';

export type AuthUser = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AppRole;
  /** `true` = ảnh upload (`photo`), `false` = preset trong app (`appAvatar`). */
  isCustomAvatar?: boolean | null;
  /** Key preset (vd. `avatar_02`) khi `isCustomAvatar === false`. */
  appAvatar?: string | null;
  /** URL hiển thị khi `isCustomAvatar === true` (trích từ `photo` trong API). */
  photoUrl?: string | null;
};

export type LoginResponse = {
  token: string;
  refreshToken: string;
  tokenExpires: number;
  user: MeResponse;
};

export type RefreshResponse = {
  token: string;
  refreshToken: string;
  tokenExpires: number;
};

/** Raw API user shape from GET /auth/me or login */
export type MeResponse = {
  id: number;
  email: string;
  provider?: string;
  socialId?: string | null;
  firstName: string | null;
  lastName: string | null;
  role: { id: number; name: string };
  status?: { id: number; name: string };
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  isCustomAvatar?: boolean | null;
  appAvatar?: string | null;
  photo?: unknown;
};

/** PATCH /auth/me — Postman: preset hoặc upload file. */
export type PatchAuthMePayload = {
  firstName?: string;
  lastName?: string;
  isCustomAvatar?: boolean;
  appAvatar?: string | null;
  photo?: { id: string } | null;
};

export function mapApiRoleToAppRole(name: string): AppRole {
  const n = name.toLowerCase();
  if (n === 'admin') return 'admin';
  if (n === 'owner') return 'owner';
  if (n === 'driver' || n === 'user') return 'driver';
  return 'driver';
}

export function meToAuthUser(me: MeResponse): AuthUser {
  const photoUrl = extractPhotoUrlFromApi(me.photo);
  return {
    id: me.id,
    email: me.email,
    firstName: me.firstName,
    lastName: me.lastName,
    role: mapApiRoleToAppRole(me.role?.name ?? 'driver'),
    isCustomAvatar: me.isCustomAvatar ?? undefined,
    appAvatar: me.appAvatar ?? undefined,
    photoUrl: photoUrl ?? undefined,
  };
}
