import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import {
  cancelTrip as cancelTripApi,
  completeTrip as completeTripApi,
  createTrip,
  fetchMyActiveTrip,
  startTripById,
} from '@/lib/api/trips';
import { resumeDriverTrackingIfNeeded, stopTrackingUpdates } from '@/lib/tracking/driver-tracking';
import {
  loadPersistedDriverTrip,
  savePersistedDriverTrip,
} from '@/lib/tracking/driver-trip-storage';
import type { Trip, TripCreatePayload } from '@/lib/types/ops';

type DriverTripContextValue = {
  activeTrip: Trip | null;
  trackingDesired: boolean;
  hydrated: boolean;
  lastError: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  setTrackingEnabled: (enabled: boolean) => Promise<{ ok: boolean; message?: string }>;
  createAndStartTrip: (body: TripCreatePayload) => Promise<void>;
  completeActiveTrip: () => Promise<void>;
  cancelActiveTrip: () => Promise<void>;
  startPlannedActiveTrip: () => Promise<void>;
};

const inactiveDriverTripValue: DriverTripContextValue = {
  activeTrip: null,
  trackingDesired: false,
  hydrated: true,
  lastError: null,
  busy: false,
  refresh: async () => {},
  setTrackingEnabled: async () => ({ ok: false, message: 'Chỉ dành cho tài xế.' }),
  createAndStartTrip: async () => {
    throw new Error('Chỉ dành cho tài xế.');
  },
  completeActiveTrip: async () => {},
  cancelActiveTrip: async () => {},
  startPlannedActiveTrip: async () => {},
};

const DriverTripContext = createContext<DriverTripContextValue>(inactiveDriverTripValue);

function DriverTripProviderInner({ children }: { children: React.ReactNode }) {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [trackingDesired, setTrackingDesired] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resumeGen = useRef(0);

  const refresh = useCallback(async () => {
    setLastError(null);
    try {
      const trip = await fetchMyActiveTrip();
      setActiveTrip(trip);
    } catch (e) {
      setLastError(getErrorMessage(e, 'Không tải được chuyến'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = await loadPersistedDriverTrip();
      try {
        const trip = await fetchMyActiveTrip();
        if (cancelled) return;
        setActiveTrip(trip);
        if (
          persisted &&
          trip &&
          String(trip.id) === persisted.activeTripId &&
          persisted.trackingDesired &&
          trip.status === 'in_progress'
        ) {
          setTrackingDesired(true);
        } else if (persisted?.trackingDesired && (!trip || String(trip.id) !== persisted.activeTripId)) {
          setTrackingDesired(false);
          await savePersistedDriverTrip(null);
          await stopTrackingUpdates();
        }
      } catch (e) {
        if (!cancelled) {
          setLastError(getErrorMessage(e, 'Không tải được chuyến'));
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!activeTrip || activeTrip.status !== 'in_progress') {
      void savePersistedDriverTrip(null);
      return;
    }
    void savePersistedDriverTrip({
      activeTripId: String(activeTrip.id),
      trackingDesired,
    });
  }, [hydrated, activeTrip, trackingDesired]);

  useEffect(() => {
    if (!hydrated || !activeTrip || activeTrip.status !== 'in_progress' || !trackingDesired) {
      return;
    }
    const gen = ++resumeGen.current;
    let cancelled = false;

    (async () => {
      try {
        const r = await resumeDriverTrackingIfNeeded(String(activeTrip.id));
        if (cancelled || gen !== resumeGen.current) return;
        if (!r.ok) {
          setLastError(r.message ?? 'Không bật được GPS nền');
          return;
        }
        setLastError(null);
      } catch (e) {
        if (!cancelled && gen === resumeGen.current) {
          setLastError(getErrorMessage(e, 'Không bật được GPS nền'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, activeTrip, trackingDesired]);

  const setTrackingEnabled = useCallback(
    async (enabled: boolean): Promise<{ ok: boolean; message?: string }> => {
      if (!activeTrip || activeTrip.status !== 'in_progress') {
        return { ok: false, message: 'Không có chuyến đang chạy.' };
      }
      if (enabled) {
        const r = await resumeDriverTrackingIfNeeded(String(activeTrip.id));
        if (!r.ok) {
          setLastError(r.message ?? 'Không bật được GPS');
          return { ok: false, message: r.message };
        }
        setTrackingDesired(true);
        setLastError(null);
        return { ok: true };
      }
      await stopTrackingUpdates();
      setTrackingDesired(false);
      return { ok: true };
    },
    [activeTrip],
  );

  const createAndStartTrip = useCallback(async (body: TripCreatePayload) => {
    setBusy(true);
    setLastError(null);
    try {
      const trip = await createTrip(body);
      setActiveTrip(trip);
      if (trip.status === 'in_progress') {
        setTrackingDesired(false);
      }
    } catch (e) {
      setLastError(getErrorMessage(e, 'Không tạo được chuyến'));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const completeActiveTrip = useCallback(async () => {
    if (!activeTrip) return;
    setBusy(true);
    setLastError(null);
    try {
      await stopTrackingUpdates();
      setTrackingDesired(false);
      await savePersistedDriverTrip(null);
      await completeTripApi(activeTrip.id);
      setActiveTrip(null);
    } catch (e) {
      setLastError(getErrorMessage(e, 'Không kết thúc được chuyến'));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [activeTrip]);

  const cancelActiveTrip = useCallback(async () => {
    if (!activeTrip) return;
    setBusy(true);
    setLastError(null);
    try {
      await stopTrackingUpdates();
      setTrackingDesired(false);
      await savePersistedDriverTrip(null);
      await cancelTripApi(activeTrip.id);
      setActiveTrip(null);
    } catch (e) {
      setLastError(getErrorMessage(e, 'Không hủy được chuyến'));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [activeTrip]);

  const startPlannedActiveTrip = useCallback(async () => {
    if (!activeTrip) return;
    if (activeTrip.status !== 'planned') {
      setLastError('Chuyến không ở trạng thái chờ xuất phát.');
      return;
    }
    setBusy(true);
    setLastError(null);
    try {
      const trip = await startTripById(activeTrip.id);
      setActiveTrip(trip);
    } catch (e) {
      setLastError(getErrorMessage(e, 'Không bắt đầu được chuyến'));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [activeTrip]);

  const value = useMemo(
    () => ({
      activeTrip,
      trackingDesired,
      hydrated,
      lastError,
      busy,
      refresh,
      setTrackingEnabled,
      createAndStartTrip,
      completeActiveTrip,
      cancelActiveTrip,
      startPlannedActiveTrip,
    }),
    [
      activeTrip,
      trackingDesired,
      hydrated,
      lastError,
      busy,
      refresh,
      setTrackingEnabled,
      createAndStartTrip,
      completeActiveTrip,
      cancelActiveTrip,
      startPlannedActiveTrip,
    ],
  );

  return <DriverTripContext.Provider value={value}>{children}</DriverTripContext.Provider>;
}

export function DriverTripProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'driver') {
    return (
      <DriverTripContext.Provider value={inactiveDriverTripValue}>{children}</DriverTripContext.Provider>
    );
  }
  return <DriverTripProviderInner>{children}</DriverTripProviderInner>;
}

export function useDriverTrip(): DriverTripContextValue {
  return useContext(DriverTripContext);
}
