import { getAppAvatarSource } from '@/constants/app-avatars';
import { Images, pickDefaultAvatar } from '@/constants/images';
import type { AuthUser } from '@/lib/auth/types';

export type ResolvedAvatarDisplay =
  | { kind: 'preset'; source: number }
  | { kind: 'remote'; uri: string }
  | { kind: 'fallback'; source: number };

/**
 * Hiển thị avatar: preset (`appAvatar`) hoặc ảnh upload (`isCustomAvatar` + URL ảnh).
 * Nếu API chưa trả đủ field, fallback giống màn Cài đặt cũ.
 */
export function resolveAvatarDisplay(user: AuthUser | null): ResolvedAvatarDisplay {
  if (!user) {
    return { kind: 'preset', source: Images.keoTramLogo };
  }
  const hasApiAvatar =
    user.isCustomAvatar === true ||
    (user.isCustomAvatar === false && Boolean(user.appAvatar)) ||
    Boolean(user.photoUrl);
  if (user.role === 'admin' && !hasApiAvatar) {
    return { kind: 'preset', source: Images.keoTramLogo };
  }
  if (user.isCustomAvatar === true && user.photoUrl) {
    return { kind: 'remote', uri: user.photoUrl };
  }
  if (user.isCustomAvatar === false && user.appAvatar) {
    const src = getAppAvatarSource(user.appAvatar);
    if (src) return { kind: 'preset', source: src };
  }
  return { kind: 'fallback', source: pickDefaultAvatar(user.id) };
}
