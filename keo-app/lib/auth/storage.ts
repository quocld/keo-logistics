import * as SecureStore from 'expo-secure-store';

const ACCESS = 'keotram_access_token';
const REFRESH = 'keotram_refresh_token';
const EXPIRES = 'keotram_token_expires';

export async function saveTokens(access: string, refresh: string, tokenExpires: number): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
  await SecureStore.setItemAsync(EXPIRES, String(tokenExpires));
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  await SecureStore.deleteItemAsync(EXPIRES);
}
