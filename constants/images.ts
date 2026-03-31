const DEFAULT_AVATARS = [
  require('@/assets/images/default-avatars/avatar-01-owner.png'),
  require('@/assets/images/default-avatars/avatar-02-driver.png'),
  require('@/assets/images/default-avatars/avatar-03.png'),
  require('@/assets/images/default-avatars/avatar-04.png'),
  require('@/assets/images/default-avatars/avatar-05.png'),
  require('@/assets/images/default-avatars/avatar-06.png'),
  require('@/assets/images/default-avatars/avatar-07.png'),
  require('@/assets/images/default-avatars/avatar-08.png'),
  require('@/assets/images/default-avatars/avatar-09.png'),
  require('@/assets/images/default-avatars/avatar-10.png'),
  require('@/assets/images/default-avatars/avatar-11.png'),
  require('@/assets/images/default-avatars/avatar-12.png'),
] as const;

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0;
  const m = i % len;
  return m < 0 ? m + len : m;
}

/** Pick a stable avatar by numeric seed (e.g. user.id). */
export function pickDefaultAvatar(seed: number | undefined | null) {
  const len = DEFAULT_AVATARS.length;
  const s = typeof seed === 'number' && Number.isFinite(seed) ? seed : 0;
  return DEFAULT_AVATARS[clampIndex(Math.floor(s), len)];
}

export const Images = {
  keoTramLogo: require('@/assets/images/keotram-logo.png'),
  defaultAvatars: DEFAULT_AVATARS,
} as const;

