import type { MeResponse, PatchAuthMePayload } from '@/lib/auth/types';

import { apiFetchJson } from './client';

export async function patchAuthMe(body: PatchAuthMePayload): Promise<MeResponse> {
  return apiFetchJson<MeResponse>('/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
