import type { UserCreatePayload } from '@/lib/types/ops';

import { apiFetch } from './client';

export async function createUser(body: UserCreatePayload): Promise<unknown> {
  const res = await apiFetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error(text.slice(0, 200) || res.statusText);
    }
  }
  if (!res.ok) {
    const msg = (parsed as { message?: string }).message ?? res.statusText;
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return parsed;
}
