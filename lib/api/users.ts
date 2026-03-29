import type { UserCreatePayload } from '@/lib/types/ops';

import { apiFetch } from './client';
import { formatApiErrorFromJsonText, formatApiErrorPayload } from './errors';

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
      throw new Error(formatApiErrorFromJsonText(text, res.statusText, res.status));
    }
  }
  if (!res.ok) {
    throw new Error(formatApiErrorPayload(parsed, res.statusText, res.status));
  }
  return parsed;
}
