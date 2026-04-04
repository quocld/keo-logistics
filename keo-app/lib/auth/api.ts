import { formatApiErrorFromJsonText, formatApiErrorPayload } from '@/lib/api/errors';
import { getApiBaseUrl } from '@/lib/config';

import type { LoginResponse, MeResponse, RefreshResponse } from './types';

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error('Empty response');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200));
  }
}

export async function loginWithEmail(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${getApiBaseUrl()}/auth/email/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(formatApiErrorFromJsonText(text, res.statusText, res.status));
    }
  }
  if (!res.ok) {
    throw new Error(formatApiErrorPayload(data, res.statusText, res.status));
  }
  return data as LoginResponse;
}

export async function refreshSession(refreshToken: string): Promise<RefreshResponse> {
  const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      Accept: 'application/json',
    },
  });
  const data = await parseJson<RefreshResponse & { message?: string }>(res);
  if (!res.ok) {
    throw new Error(formatApiErrorPayload(data, res.statusText, res.status));
  }
  return data;
}

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data = await parseJson<MeResponse & { message?: string }>(res);
  if (!res.ok) {
    throw new Error(formatApiErrorPayload(data, res.statusText, res.status));
  }
  return data;
}

export async function logoutApi(accessToken: string): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
  } catch {
    /* best-effort */
  }
}

export async function forgotPasswordApi(email: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/auth/forgot/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatApiErrorFromJsonText(text, res.statusText, res.status));
  }
}
