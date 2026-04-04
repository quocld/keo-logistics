/** Matches Postman `{{baseUrl}}` (includes `/api/v1`). */
export const DEFAULT_API_BASE = 'https://keo-be-production.up.railway.app/api/v1';

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '').trim();
  return fromEnv || DEFAULT_API_BASE;
}

/** Align with backend `FILE_DRIVER`: `presigned` ↔ s3-presigned; `multipart` ↔ local / s3 direct. */
export type OpsFileUploadMode = 'presigned' | 'multipart';

/** True when API is almost certainly a dev server (multipart upload), not Railway production presigned. */
function looksLikeLocalApiUrl(base: string): boolean {
  const b = base.toLowerCase();
  if (b.includes('localhost') || b.includes('127.0.0.1') || b.includes('10.0.2.2')) {
    return true;
  }
  try {
    const u = new URL(base.startsWith('http') ? base : `https://${base}`);
    if (u.hostname === 'localhost') return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) {
      const p = u.hostname.split('.').map(Number);
      if (p[0] === 10) return true;
      if (p[0] === 192 && p[1] === 168) return true;
      if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Explicit `EXPO_PUBLIC_OPS_FILE_UPLOAD` wins.
 * If unset: **presigned** for hosted APIs (e.g. Railway + `FILE_DRIVER=s3-presigned`); **multipart** for local/LAN dev.
 */
export function getOpsFileUploadMode(): OpsFileUploadMode {
  const raw = process.env.EXPO_PUBLIC_OPS_FILE_UPLOAD?.trim().toLowerCase();
  if (raw === 'presigned') return 'presigned';
  if (raw === 'multipart') return 'multipart';
  return looksLikeLocalApiUrl(getApiBaseUrl()) ? 'multipart' : 'presigned';
}
