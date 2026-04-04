import { getAppAvatarSource } from '@/constants/app-avatars';
import { pickDefaultAvatar } from '@/constants/images';
import type { OwnerDriverLatestLocation } from '@/lib/api/owner-driver-locations';
import {
  collectNestedProfileRecords,
  extractPhotoUrlFromLocationPayload,
} from '@/lib/avatar/extract-photo-url';
import type { ResolvedAvatarDisplay } from '@/lib/avatar/resolve-display';

function readAvatarFlags(records: Record<string, unknown>[]): {
  isCustomAvatar?: boolean;
  appAvatar: string | null;
} {
  let isCustomAvatar: boolean | undefined;
  let appAvatar: string | null = null;
  for (const r of records) {
    if (isCustomAvatar === undefined && typeof r.isCustomAvatar === 'boolean') {
      isCustomAvatar = r.isCustomAvatar;
    }
    if (!appAvatar && typeof r.appAvatar === 'string' && r.appAvatar.trim()) {
      appAvatar = r.appAvatar.trim();
    }
  }
  return { isCustomAvatar, appAvatar };
}

function defaultAvatarSeed(loc: OwnerDriverLatestLocation): number {
  const seed = Number(loc.driverUserId ?? loc.userId ?? loc.driverId ?? 0);
  return Number.isFinite(seed) ? seed : 0;
}

/**
 * Avatar cho pin / callout trên bản đồ theo dõi (GET …/locations/latest).
 * - `isCustomAvatar === true` + URL từ `photo` (object hoặc chuỗi http) → remote
 * - `isCustomAvatar === false` + `appAvatar` → preset trong app (avatar_01…)
 * - Không có flag (API cũ): URL nếu có → `appAvatar` → `pickDefaultAvatar(seed)`
 */
export function resolveDriverLocationAvatar(loc: OwnerDriverLatestLocation): ResolvedAvatarDisplay {
  const records = collectNestedProfileRecords(loc);
  const { isCustomAvatar, appAvatar } = readAvatarFlags(records);
  const photoUrl = extractPhotoUrlFromLocationPayload(loc);
  const seed = defaultAvatarSeed(loc);

  if (isCustomAvatar === true) {
    if (photoUrl) return { kind: 'remote', uri: photoUrl };
    return { kind: 'fallback', source: pickDefaultAvatar(seed) };
  }

  if (isCustomAvatar === false) {
    if (appAvatar) {
      const src = getAppAvatarSource(appAvatar);
      if (src) return { kind: 'preset', source: src };
    }
    return { kind: 'fallback', source: pickDefaultAvatar(seed) };
  }

  if (photoUrl) return { kind: 'remote', uri: photoUrl };
  if (appAvatar) {
    const src = getAppAvatarSource(appAvatar);
    if (src) return { kind: 'preset', source: src };
  }
  return { kind: 'fallback', source: pickDefaultAvatar(seed) };
}
