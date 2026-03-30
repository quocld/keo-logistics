import { apiFetchJson } from '@/lib/api/client';

export type ExpoPushPlatform = 'ios' | 'android';

export type RegisterExpoPushBody = {
  expoPushToken: string;
  platform: ExpoPushPlatform;
  enabled: boolean;
  easProjectId?: string;
  easEnvironment?: string;
};

/** Response shape from Nest — extend when backend contract is fixed. */
export type RegisterExpoPushResponse = {
  id?: string;
  expoPushToken?: string;
  platform?: string;
  isEnabled?: boolean;
  userId?: string | number;
  [key: string]: unknown;
};

export async function registerExpoPushDevice(
  body: RegisterExpoPushBody,
): Promise<RegisterExpoPushResponse> {
  return apiFetchJson<RegisterExpoPushResponse>('/notifications/expo/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
