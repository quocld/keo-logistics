import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { AvatarResolvedImage } from '@/components/profile/AvatarResolvedImage';
import { Brand } from '@/constants/brand';
import { useDriverTrip } from '@/contexts/driver-trip-context';
import { resolveAvatarDisplay } from '@/lib/avatar/resolve-display';
import { useUnreadNotificationBadge } from '@/hooks/use-unread-notification-badge';
import { getVehicle } from '@/lib/api/vehicles';
import type { AuthUser } from '@/lib/auth/types';
import type { Vehicle } from '@/lib/types/ops';

const S = Brand.stitch;

const WEEKDAYS_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function displayName(user: AuthUser): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.email.split('@')[0] ?? user.email;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatTodayVi(d: Date): string {
  return `Hôm nay là ${WEEKDAYS_VI[d.getDay()]}, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

function tripStatusUi(status: string): { label: string; bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s === 'in_progress') {
    return { label: 'Đang chạy', bg: `${S.primary}18`, fg: S.primary };
  }
  if (s === 'planned') {
    return { label: 'Chờ xuất phát', bg: `${S.tertiary}22`, fg: S.tertiary };
  }
  if (s === 'completed') {
    return { label: 'Hoàn thành', bg: `${Brand.metallicDeep}33`, fg: Brand.inkMuted };
  }
  if (s === 'cancelled') {
    return { label: 'Đã hủy', bg: '#ffebee', fg: '#c62828' };
  }
  return { label: status, bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
}

function shortTripId(id: string | number): string {
  const s = String(id);
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

type DriverHomeProps = {
  user: AuthUser;
};

export function DriverHome({ user }: DriverHomeProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { badgeText: notifBadgeText } = useUnreadNotificationBadge();
  const { activeTrip, trackingDesired, hydrated, lastError, refresh } = useDriverTrip();
  const todayLine = useMemo(() => formatTodayVi(new Date()), []);

  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    let cancelled = false;
    const vehicleId = (activeTrip?.vehicleId ?? null) as string | number | null;
    if (!vehicleId) {
      setVehicle(null);
      return;
    }
    setVehicleLoading(true);
    (async () => {
      try {
        const v = await getVehicle(vehicleId);
        if (!cancelled) setVehicle(v);
      } catch {
        if (!cancelled) setVehicle(null);
      } finally {
        if (!cancelled) setVehicleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTrip?.vehicleId]);

  const greet = displayName(user);
  const tripPill = activeTrip ? tripStatusUi(activeTrip.status) : null;
  const headerAvatar = resolveAvatarDisplay(user);

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <MaterialIcons name="local-shipping" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            KeoTram
          </Text>
        </View>
        <View style={os.topBarRight}>
          <NotificationBellButton
            badgeText={notifBadgeText}
            onPress={() => router.push('/notifications' as Href)}
          />
          <Pressable
            onPress={() => router.push('./settings')}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}
            accessibilityLabel="Cài đặt">
            <MaterialIcons name="settings" size={24} color={S.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
      <View style={os.hairline} />

      <ScrollView
        style={os.flatListFlex}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#e8f5ec', Brand.canvas]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroEyebrow}>Tài xế vận chuyển</Text>
              <Text style={styles.heroGreet}>
                {greetingByHour()}, {greet}
              </Text>
              <Text style={styles.heroDate}>{todayLine}</Text>
            </View>
            <View style={styles.avatar}>
              <AvatarResolvedImage display={headerAvatar} style={styles.avatarImg} />
            </View>
          </View>
          <Text style={styles.heroSub}>
            Theo dõi chuyến và GPS trên tab Chuyến — chủ vườn xem vị trí khi bạn bật theo dõi.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>Xe của bạn</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleHead}>
            <View style={styles.vehicleIcon}>
              <MaterialIcons name="local-shipping" size={24} color={S.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.vehicleTitle} numberOfLines={1}>
                {vehicleLoading ? 'Đang tải xe…' : vehicle?.plate ?? 'Chưa có xe được gán'}
              </Text>
              <Text style={styles.vehicleSub} numberOfLines={2}>
                {vehicleLoading
                  ? '—'
                  : vehicle?.name
                    ? vehicle.name
                    : vehicle
                      ? `ID: ${String(vehicle.id)}`
                      : 'Liên hệ chủ vườn để gán xe cho tài xế.'}
              </Text>
            </View>
            {vehicle ? (
              <Pressable
                onPress={() => router.push(`/vehicle/${encodeURIComponent(String(vehicle.id))}` as Href)}
                style={({ pressed }) => [styles.vehicleBtn, pressed && styles.cardPressed]}
                accessibilityRole="button"
                accessibilityLabel="Xem chi tiết xe">
                <MaterialIcons name="chevron-right" size={22} color={S.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Chuyến của bạn</Text>

        <Pressable
          onPress={() => router.push('./driver-trip')}
          style={({ pressed }) => [styles.tripCard, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel="Mở màn chuyến và GPS">
          {!hydrated ? (
            <View style={styles.tripCardLoading}>
              <ActivityIndicator color={S.primary} />
              <Text style={styles.tripCardMuted}>Đang đồng bộ chuyến…</Text>
            </View>
          ) : activeTrip ? (
            <>
              <View style={styles.tripCardHead}>
                {tripPill ? (
                  <View style={[styles.statusPill, { backgroundColor: tripPill.bg }]}>
                    <Text style={[styles.statusPillText, { color: tripPill.fg }]}>{tripPill.label}</Text>
                  </View>
                ) : null}
                {activeTrip.status === 'in_progress' && trackingDesired ? (
                  <View style={styles.gpsLive}>
                    <View style={styles.gpsDot} />
                    <Text style={styles.gpsLiveText}>GPS bật</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.tripId}>Chuyến #{shortTripId(activeTrip.id)}</Text>
              <Text style={styles.tripMeta}>
                {activeTrip.harvestAreaId != null
                  ? `Khu ${String(activeTrip.harvestAreaId)}`
                  : 'Khu chưa rõ'}
                {' · '}
                {activeTrip.weighingStationId != null
                  ? `Trạm ${String(activeTrip.weighingStationId)}`
                  : 'Trạm chưa rõ'}
              </Text>
              <View style={styles.tripCardFooter}>
                <Text style={styles.tripCta}>Quản lý chuyến & GPS</Text>
                <MaterialIcons name="chevron-right" size={22} color={S.primary} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.tripEmptyIcon}>
                <MaterialIcons name="route" size={32} color={S.primary} />
              </View>
              <Text style={styles.tripEmptyTitle}>Chưa có chuyến đang mở</Text>
              <Text style={styles.tripEmptySub}>
                Tạo chuyến mới hoặc xem trạng thái trên màn hình Chuyến.
              </Text>
              <View style={styles.tripCardFooter}>
                <Text style={styles.tripCta}>Bắt đầu chuyến</Text>
                <MaterialIcons name="chevron-right" size={22} color={S.primary} />
              </View>
            </>
          )}
        </Pressable>

        {lastError ? (
          <View style={styles.warnBanner}>
            <MaterialIcons name="info-outline" size={20} color={S.tertiary} />
            <Text style={styles.warnText}>{lastError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push('./driver-trip')}
          style={({ pressed }) => [styles.primaryCtaWrap, pressed && { opacity: 0.92 }]}>
          <LinearGradient
            colors={[S.primary, S.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryCta}>
            <MaterialIcons name="navigation" size={24} color="#fff" />
            <Text style={styles.primaryCtaText}>Vào màn Chuyến & GPS</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => router.push('/receipt/driver' as Href)}
          style={({ pressed }) => [styles.receiptCtaWrap, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Gửi phiếu cân">
          <View style={styles.receiptCta}>
            <MaterialIcons name="receipt-long" size={24} color={S.primary} />
            <Text style={styles.receiptCtaText}>Gửi phiếu cân</Text>
            <MaterialIcons name="chevron-right" size={22} color={S.primary} />
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>Thao tác nhanh</Text>
        <View style={styles.quickGrid}>
          <Pressable
            style={({ pressed }) => [styles.quickTile, pressed && styles.cardPressed]}
            onPress={() => router.push('/weighing-stations-map')}>
            <View style={[styles.quickIcon, { backgroundColor: `${S.primary}14` }]}>
              <MaterialIcons name="map" size={26} color={S.primary} />
            </View>
            <Text style={styles.quickTitle}>Bản đồ</Text>
            <Text style={styles.quickSub}>Trạm & khu (GPS)</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickTile, pressed && styles.cardPressed]}
            onPress={() => router.push('./settings')}>
            <View style={[styles.quickIcon, { backgroundColor: S.surfaceContainerHigh }]}>
              <MaterialIcons name="tune" size={26} color={Brand.ink} />
            </View>
            <Text style={styles.quickTitle}>Cài đặt</Text>
            <Text style={styles.quickSub}>Tài khoản & đăng xuất</Text>
          </Pressable>
        </View>

        <View style={styles.tipCard}>
          <MaterialIcons name="lightbulb-outline" size={22} color={S.primary} />
          <View style={styles.tipBody}>
            <Text style={styles.tipTitle}>Gợi ý</Text>
            <Text style={styles.tipText}>
              Bật quyền vị trí “Luôn luôn” khi chủ vườn cần theo dõi xe lúc app ở nền. Tắt GPS trong màn Chuyến khi
              không vận chuyển để tiết kiệm pin.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}99`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  heroGreet: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Brand.ink,
    lineHeight: 30,
  },
  heroDate: {
    marginTop: 8,
    fontSize: 14,
    color: S.onSurfaceVariant,
    lineHeight: 20,
  },
  heroSub: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
    color: Brand.inkMuted,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: `${S.primary}44`,
    overflow: 'hidden',
  },
  avatarImg: { width: 56, height: 56 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 10,
  },
  vehicleCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}cc`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  vehicleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: `${S.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  vehicleSub: {
    fontSize: 13,
    lineHeight: 19,
    color: S.onSurfaceVariant,
  },
  vehicleBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${S.primary}0d`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.primary}2a`,
  },
  tripCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}cc`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.94,
  },
  tripCardLoading: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  tripCardMuted: {
    fontSize: 14,
    color: S.onSurfaceVariant,
  },
  tripCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  gpsLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: S.primary,
  },
  gpsLiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: S.primary,
  },
  tripId: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 6,
  },
  tripMeta: {
    fontSize: 14,
    color: S.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 16,
  },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.surfaceContainerHigh,
  },
  tripCta: {
    fontSize: 15,
    fontWeight: '700',
    color: S.primary,
  },
  tripEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${S.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  tripEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 6,
  },
  tripEmptySub: {
    fontSize: 14,
    color: S.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 8,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: S.tertiaryFixed,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${S.tertiary}33`,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: S.onTertiaryFixed,
  },
  primaryCtaWrap: {
    marginBottom: 26,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 17,
    paddingHorizontal: 20,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  receiptCtaWrap: {
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.primary}55`,
    backgroundColor: Brand.surface,
    overflow: 'hidden',
  },
  receiptCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: `${S.primary}0d`,
  },
  receiptCtaText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: -0.2,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  quickTile: {
    flex: 1,
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}aa`,
    minHeight: 128,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 4,
  },
  quickSub: {
    fontSize: 12,
    color: S.onSurfaceVariant,
    lineHeight: 17,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: S.surfaceContainerLow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: S.outlineVariant,
  },
  tipBody: {
    flex: 1,
    minWidth: 0,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: S.onSurfaceVariant,
  },
});
