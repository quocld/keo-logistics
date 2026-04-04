function isHttpUrl(v: unknown): v is string {
  return typeof v === 'string' && /^\s*https?:\/\//i.test(v.trim());
}

const NESTED_PROFILE_KEYS = ['user', 'driver', 'profile'] as const;

/** Chuỗi http(s) có thể chứa URL ảnh ở payload phẳng hoặc nested. */
const HTTP_AVATAR_FIELD_KEYS = [
  'photo',
  'avatarUrl',
  'avatar',
  'profilePhotoUrl',
  'imageUrl',
  'picture',
] as const;

/** URL ảnh tùy chỉnh từ object `photo` trong response API (path/url/imageUrl, nested file). */
export function extractPhotoUrlFromApi(photo: unknown): string | null {
  if (isHttpUrl(photo)) return photo.trim();
  if (photo && typeof photo === 'object') {
    const p = photo as Record<string, unknown>;
    for (const k of ['path', 'url', 'imageUrl']) {
      const v = p[k];
      if (isHttpUrl(v)) return v.trim();
    }
    const file = p.file;
    if (file && typeof file === 'object') {
      const f = file as Record<string, unknown>;
      for (const k of ['path', 'url']) {
        const v = f[k];
        if (isHttpUrl(v)) return v.trim();
      }
    }
  }
  return null;
}

/**
 * Root + các object lồng `user` | `driver` | `profile` (nếu có).
 * Dùng để đọc `photo` object hoặc flag avatar trên payload API.
 */
export function collectNestedProfileRecords(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const o = payload as Record<string, unknown>;
  const out: Record<string, unknown>[] = [o];
  for (const k of NESTED_PROFILE_KEYS) {
    const n = o[k];
    if (n && typeof n === 'object' && !Array.isArray(n)) {
      out.push(n as Record<string, unknown>);
    }
  }
  return out;
}

/**
 * URL ảnh từ payload GET /owner/drivers/locations/latest (và tương tự):
 * `photo` dạng object hoặc chuỗi http ở root hoặc nested user/driver/profile.
 */
export function extractPhotoUrlFromLocationPayload(loc: unknown): string | null {
  const records = collectNestedProfileRecords(loc);
  for (const r of records) {
    const u = extractPhotoUrlFromApi(r.photo);
    if (u) return u;
  }
  for (const r of records) {
    for (const k of HTTP_AVATAR_FIELD_KEYS) {
      const v = r[k];
      if (isHttpUrl(v)) return v.trim();
    }
  }
  return null;
}
