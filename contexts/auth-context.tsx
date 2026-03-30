import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { setSessionInvalidHandler } from '@/lib/api/session-events';
import { registerPushForCurrentSession, unregisterPushBestEffort } from '@/lib/push/register-expo-push';
import { fetchMe, loginWithEmail, logoutApi } from '@/lib/auth/api';
import { clearTokens, getAccessToken, saveTokens } from '@/lib/auth/storage';
import { stopTrackingUpdates } from '@/lib/tracking/driver-tracking';
import { clearDriverTripPersistence } from '@/lib/tracking/driver-trip-storage';
import type { AppRole, AuthUser } from '@/lib/auth/types';
import { meToAuthUser } from '@/lib/auth/types';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastPushRegisteredUserId = useRef<number | null>(null);

  const hydrate = useCallback(async () => {
    try {
      const access = await getAccessToken();
      if (!access) {
        setUser(null);
        return;
      }
      const me = await fetchMe(access);
      setUser(meToAuthUser(me));
    } catch {
      await clearTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrate();
      if (!cancelled) {
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    setSessionInvalidHandler(() => {
      setUser(null);
    });
    return () => setSessionInvalidHandler(null);
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user) {
      lastPushRegisteredUserId.current = null;
      return;
    }
    if (lastPushRegisteredUserId.current === user.id) {
      return;
    }
    lastPushRegisteredUserId.current = user.id;
    void registerPushForCurrentSession();
  }, [isLoading, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const login = await loginWithEmail(email, password);
    await saveTokens(login.token, login.refreshToken, login.tokenExpires);
    const me = await fetchMe(login.token);
    const u = meToAuthUser(me);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await unregisterPushBestEffort();
    } catch {
      /* best-effort */
    }
    try {
      await stopTrackingUpdates();
      await clearDriverTripPersistence();
    } catch {
      /* best-effort */
    }
    const access = await getAccessToken();
    if (access) {
      await logoutApi(access);
    }
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const access = await getAccessToken();
    if (!access) {
      setUser(null);
      return;
    }
    const me = await fetchMe(access);
    setUser(meToAuthUser(me));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      signIn,
      signOut,
      refreshUser,
    }),
    [user, isLoading, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function getPostLoginPath(role: AppRole): '/(app)/admin-notice' | '/(app)/(tabs)' {
  if (role === 'admin') {
    return '/(app)/admin-notice';
  }
  return '/(app)/(tabs)';
}
