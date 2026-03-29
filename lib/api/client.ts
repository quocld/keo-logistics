import { refreshSession } from '@/lib/auth/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/lib/auth/storage';
import { getApiBaseUrl } from '@/lib/config';

import { formatApiErrorPayload, formatApiErrorFromJsonText } from './errors';
import { emitSessionInvalid } from './session-events';

let refreshChain: Promise<void> | null = null;

async function refreshTokensOnce(): Promise<void> {
  if (!refreshChain) {
    refreshChain = (async () => {
      const rt = await getRefreshToken();
      if (!rt) {
        await clearTokens();
        emitSessionInvalid();
        throw new Error('Unauthorized');
      }
      try {
        const next = await refreshSession(rt);
        await saveTokens(next.token, next.refreshToken, next.tokenExpires);
      } catch {
        await clearTokens();
        emitSessionInvalid();
        throw new Error('Unauthorized');
      }
    })().finally(() => {
      refreshChain = null;
    });
  }
  await refreshChain;
}

export type ApiFetchOptions = RequestInit & {
  /** Skip Authorization header and refresh logic */
  skipAuth?: boolean;
};

/**
 * JSON fetch to API with Bearer access token and one 401 → refresh → retry.
 */
export async function apiFetch(path: string, init: ApiFetchOptions = {}): Promise<Response> {
  const { skipAuth, ...rest } = init;
  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  async function once(retryAfterRefresh: boolean): Promise<Response> {
    const headers = new Headers(rest.headers);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (!skipAuth) {
      const access = await getAccessToken();
      if (access) {
        headers.set('Authorization', `Bearer ${access}`);
      }
    }

    const res = await fetch(url, { ...rest, headers });

    if (res.status === 401 && !skipAuth && !retryAfterRefresh) {
      try {
        await refreshTokensOnce();
      } catch {
        return res;
      }
      const access = await getAccessToken();
      if (access) {
        headers.set('Authorization', `Bearer ${access}`);
      }
      return fetch(url, { ...rest, headers });
    }

    return res;
  }

  return once(false);
}

export async function apiFetchJson<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  if (!text) {
    if (!res.ok) {
      throw new Error(formatApiErrorPayload(null, res.statusText, res.status));
    }
    return {} as T;
  }
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    if (!res.ok) {
      throw new Error(formatApiErrorFromJsonText(text, res.statusText, res.status));
    }
    throw new Error(text.trim().slice(0, 300) || 'Phản hồi không hợp lệ');
  }
  if (!res.ok) {
    throw new Error(formatApiErrorPayload(data, res.statusText, res.status));
  }
  return data;
}
