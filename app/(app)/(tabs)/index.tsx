import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DriverHome } from '@/components/driver/driver-home';
import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { Images } from '@/constants/images';
import { useAuth } from '@/contexts/auth-context';
import { useUnreadNotificationBadge } from '@/hooks/use-unread-notification-badge';
import {
  buildPerformanceBarsFromFinanceReport,
  chartMaxValue,
  dailyAvgWeightFromSummary,
  fleetFromStatus,
  formatSignedPercent,
  marginPercentFromSummary,
  profitFromSummary,
  revenueFromSummary,
  topDriverFromSummary,
  totalWeightFromSummary,
  trendFromPercent,
} from '@/lib/analytics/owner-home-map';
import { getDashboardSummary, getFinanceReportLast7Days } from '@/lib/api/analytics';
import { listReceipts } from '@/lib/api/receipts';
import type { OwnerDashboardSummary } from '@/lib/types/analytics';

const S = Brand.stitch;

/** Chỉ mount khi màn owner — tránh gọi API badge khi user là tài xế. */
function OwnerNotificationBell() {
  const router = useRouter();
  const { badgeText } = useUnreadNotificationBadge();
  return (
    <NotificationBellButton badgeText={badgeText} onPress={() => router.push('/notifications' as Href)} />
  );
}

function displayName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.email.split('@')[0] ?? user.email;
}

function formatVndCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('vi-VN');
}

type Trend = 'up' | 'down' | 'neutral';

type QuickAction = {
  label: string;
  href: Href;
  icon: ImageSourcePropType;
};

function QuickActions({
  items,
  itemWidth,
  gap,
  onPress,
}: {
  items: QuickAction[];
  itemWidth: number;
  gap: number;
  onPress: (href: Href) => void;
}) {
  return (
    <View style={[qa.wrap, { gap }]}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          onPress={() => onPress(it.href)}
          style={({ pressed }) => [qa.item, { width: itemWidth }, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityLabel={it.label}>
          <View style={qa.iconWrap}>
            <Image source={it.icon} style={qa.icon} />
          </View>
          <Text style={qa.label} numberOfLines={2}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatTile({
  label,
  value,
  subLabel,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  subLabel?: string;
  trend?: Trend;
  trendLabel?: string;
}) {
  const trendColor =
    trend === 'up' ? S.primary : trend === 'down' ? '#c62828' : S.onSurfaceVariant;
  return (
    <View style={st.tile}>
      <Text style={st.tileLabel}>{label}</Text>
      <Text style={st.tileValue}>{value}</Text>
      {subLabel ? <Text style={st.tileSub}>{subLabel}</Text> : null}
      {trend && trendLabel ? (
        <View style={st.trendRow}>
          <MaterialIcons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'trending-flat'}
            size={18}
            color={trendColor}
          />
          <Text style={[st.trendText, { color: trendColor }]}>{trendLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Fallback khi không có GET /analytics/reports/finance (7 ngày) */
const DEMO_PERFORMANCE_BARS = [
  { value: 45, label: 'CN' },
  { value: 72, label: 'T2' },
  { value: 55, label: 'T3' },
  { value: 88, label: 'T4' },
  { value: 62, label: 'T5' },
  { value: 95, label: 'T6' },
  { value: 70, label: 'T7' },
] as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingHasMore, setPendingHasMore] = useState(false);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [performanceBars, setPerformanceBars] = useState<{ value: number; label: string }[] | null>(null);
  const [financeReportFailed, setFinanceReportFailed] = useState(false);

  const loadPending = useCallback(async () => {
    if (!isOwner) return;
    setPendingLoading(true);
    try {
      const res = await listReceipts({ page: 1, limit: 50, status: 'pending' });
      if (!res.ok) {
        setPendingCount(null);
        setPendingHasMore(false);
        return;
      }
      setPendingCount(res.body.data.length);
      setPendingHasMore(res.body.hasNextPage);
    } catch {
      setPendingCount(null);
      setPendingHasMore(false);
    } finally {
      setPendingLoading(false);
    }
  }, [isOwner]);

  const loadDashboard = useCallback(async () => {
    if (!isOwner) return;
    setSummaryLoading(true);
    setSummaryFailed(false);
    setFinanceReportFailed(false);
    try {
      const [sumRes, finRes] = await Promise.all([
        getDashboardSummary({ range: 'today' }),
        getFinanceReportLast7Days(),
      ]);
      if (sumRes.ok) {
        setSummary(sumRes.body);
      } else {
        setSummary(null);
        setSummaryFailed(true);
      }
      if (finRes.ok) {
        const bars = buildPerformanceBarsFromFinanceReport(finRes.body);
        setPerformanceBars(bars);
        setFinanceReportFailed(!bars?.length);
      } else {
        setPerformanceBars(null);
        setFinanceReportFailed(true);
      }
    } catch {
      setSummary(null);
      setSummaryFailed(true);
      setPerformanceBars(null);
      setFinanceReportFailed(true);
    } finally {
      setSummaryLoading(false);
    }
  }, [isOwner]);

  useFocusEffect(
    useCallback(() => {
      void loadPending();
      void loadDashboard();
    }, [loadPending, loadDashboard]),
  );

  const greeting = user ? displayName(user) : 'bạn';

  const performanceChartWidth = Math.max(260, windowWidth - 40 - 36);

  /** Lưới 4 cột: scroll padding 20×2 + card paddingHorizontal 4×2 */
  const quickActionGap = 8;
  const quickActionCols = 4;
  const quickActionsInnerWidth = windowWidth - 40 - 8;
  const quickActionItemWidth =
    (quickActionsInnerWidth - quickActionGap * (quickActionCols - 1)) / quickActionCols;

  const revNum = summary ? revenueFromSummary(summary) : null;
  const profitNum = summary ? profitFromSummary(summary) : null;
  const weightNum = summary ? totalWeightFromSummary(summary) : null;
  const dailyAvg = summary ? dailyAvgWeightFromSummary(summary) : null;
  const marginNum = summary ? marginPercentFromSummary(summary) : null;

  const revTrendLabel = formatSignedPercent(summary?.revenueTrendPercent);
  const profitTrendLabel = formatSignedPercent(summary?.profitTrendPercent);
  const marginTrendLabel = formatSignedPercent(summary?.marginTrendPercent);

  const revTrend = trendFromPercent(summary?.revenueTrendPercent);
  const profitTrend = trendFromPercent(summary?.profitTrendPercent);
  const marginTrend = trendFromPercent(summary?.marginTrendPercent);

  const fleetUi = fleetFromStatus(summary?.fleetStatus);
  const topDriverUi = topDriverFromSummary(summary?.topDrivers?.[0]);

  const growth30 = summary?.transportGrowthPercent30d;
  const growth30Num = typeof growth30 === 'number' && Number.isFinite(growth30) ? growth30 : null;

  const chartBars = performanceBars?.length ? performanceBars : [...DEMO_PERFORMANCE_BARS];
  const chartMax = chartMaxValue(chartBars);

  const pendingLine =
    pendingCount == null
      ? '—'
      : pendingHasMore && pendingCount >= 50
        ? `${pendingCount}+`
        : String(pendingCount);

  if (!isOwner && user) {
    return <DriverHome user={user} />;
  }

  const quickActions: QuickAction[] = [
    { label: 'Trạm cân', href: '/weighing-stations' as Href, icon: require('../../../new icons/tramcan.png') },
    { label: 'Tài xế', href: '/drivers' as Href, icon: require('@/assets/images/default-avatars/avatar-02-driver.png') },
    { label: 'Xe', href: '/vehicles' as Href, icon: require('../../../new icons/xemuc.png') },
    { label: 'Bản đồ', href: '/weighing-stations-map' as Href, icon: require('../../../new icons/map.png') },
    {
      label: 'Theo dõi TX',
      href: '/driver-tracking-map' as Href,
      icon: require('../../../new icons/xetai.png'),
    },
  ];

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <Image source={Images.keoTramLogo} style={st.topBarAppIcon} resizeMode="contain" />
          <Text style={st.topBarHello} numberOfLines={1}>
            Chào, {greeting}
          </Text>
        </View>
        <View style={os.topBarRight}>
          <OwnerNotificationBell />
        </View>
      </View>
      <View style={os.hairline} />

      <ScrollView
        style={os.flatListFlex}
        contentContainerStyle={[st.scrollPad, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}>
        {summaryFailed ? (
          <Text style={st.demoHint}>Không tải được tổng quan — kéo để thử lại hoặc kiểm tra kết nối.</Text>
        ) : null}

        {summaryLoading ? (
          <View style={st.summaryLoadingWrap}>
            <ActivityIndicator size="small" color={S.primary} />
            <Text style={st.summaryLoadingTxt}>Đang tải số liệu…</Text>
          </View>
        ) : (
          <View style={st.statGrid}>
            <StatTile
              label="Doanh thu hôm nay"
              value={revNum != null ? `${formatVndCompact(revNum)} VND` : '—'}
              trend={revTrendLabel ? revTrend : undefined}
              trendLabel={revTrendLabel ?? undefined}
            />
            <StatTile
              label="Lợi nhuận"
              value={profitNum != null ? `${formatVndCompact(profitNum)} VND` : '—'}
              trend={profitTrendLabel ? profitTrend : undefined}
              trendLabel={profitTrendLabel ?? undefined}
            />
            <StatTile
              label="Tổng khối lượng"
              value={weightNum != null ? `${weightNum.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tấn` : '—'}
              subLabel={
                dailyAvg != null
                  ? `Trung bình ngày: ${dailyAvg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tấn`
                  : 'Trung bình ngày'
              }
            />
            <StatTile
              label="Biên lợi nhuận"
              value={marginNum != null ? `${marginNum.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : '—'}
              trend={marginTrendLabel ? marginTrend : undefined}
              trendLabel={marginTrendLabel ?? undefined}
            />
          </View>
        )}

        <View style={qa.card}>
          <QuickActions
            items={quickActions}
            itemWidth={quickActionItemWidth}
            gap={quickActionGap}
            onPress={(href) => router.push(href)}
          />
        </View>

        <Pressable
          onPress={() => router.push('/receipt-approval')}
          style={({ pressed }) => [st.pendingCard, pressed && { opacity: 0.96 }]}>
          <View style={st.pendingIcon}>
            <Image
              source={require('../../../new icons/phieu.png')}
              style={st.pendingIconImg}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View style={st.pendingBody}>
            <Text style={st.pendingTitle}>Phiếu đang chờ duyệt</Text>
            <Text style={st.pendingSub}>
              {pendingCount === null && !pendingLoading
                ? 'Không tải được số liệu — vẫn có thể mở danh sách phê duyệt.'
                : pendingCount === 0
                  ? 'Không có phiếu chờ xử lý.'
                  : 'Có yêu cầu mới cần xử lý — mở danh sách phê duyệt.'}
            </Text>
            <View style={st.pendingRow}>
              {pendingLoading ? (
                <ActivityIndicator size="small" color={S.primary} />
              ) : (
                <Text style={st.pendingCount}>
                  {pendingCount === null ? '—' : pendingCount === 0 ? '0' : pendingLine} phiếu
                </Text>
              )}
              <MaterialIcons name="chevron-right" size={22} color={S.primary} />
            </View>
          </View>
        </Pressable>

        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Phân tích hiệu suất</Text>
          <Text style={st.sectionBody}>
            {growth30Num != null
              ? `Tăng trưởng vận tải trong 30 ngày qua khoảng ${Math.abs(growth30Num).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%${growth30Num >= 0 ? ' so với giai đoạn trước' : ''}.`
              : 'Theo dõi xu hướng vận tải trong 30 ngày qua.'}
          </Text>
          {financeReportFailed && !performanceBars?.length ? (
            <Text style={st.chartFallbackHint}>Biểu đồ minh họa — đồng bộ báo cáo theo ngày khi API có dữ liệu.</Text>
          ) : null}
          <View style={st.chartWrap}>
            <BarChart
              data={chartBars.map((d) => ({
                value: d.value,
                label: d.label,
                frontColor: S.primary,
                showGradient: true,
                gradientColor: `${S.primary}44`,
              }))}
              width={performanceChartWidth}
              height={190}
              barWidth={Math.min(28, Math.floor((performanceChartWidth - 48) / 7 - 10))}
              spacing={10}
              roundedTop
              roundedBottom
              isAnimated
              animationDuration={550}
              noOfSections={4}
              maxValue={chartMax}
              hideRules={false}
              rulesType="solid"
              rulesColor={`${S.outline}40`}
              rulesThickness={StyleSheet.hairlineWidth}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={`${S.outlineVariant}cc`}
              yAxisTextStyle={st.chartAxisText}
              xAxisLabelTextStyle={st.chartAxisText}
              disableScroll
            />
          </View>
        </View>

        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Trạng thái đội xe</Text>
          <View style={st.fleetHead}>
            <MaterialIcons name="local-shipping" size={28} color={S.primary} />
            <View>
              <Text style={st.fleetRatio}>
                {fleetUi ? `${fleetUi.active}/${fleetUi.total}` : '—'}
              </Text>
              <Text style={st.fleetCap}>Xe đang hoạt động</Text>
            </View>
          </View>
          <View style={st.fleetBreak}>
            <View style={st.fleetItem}>
              <Text style={st.fleetItemVal}>{fleetUi ? String(fleetUi.active) : '—'}</Text>
              <Text style={st.fleetItemLab}>Đang chạy</Text>
            </View>
            <View style={st.fleetItem}>
              <Text style={st.fleetItemVal}>{fleetUi ? String(fleetUi.maintenance) : '—'}</Text>
              <Text style={st.fleetItemLab}>Bảo trì</Text>
            </View>
            <View style={st.fleetItem}>
              <Text style={st.fleetItemVal}>{fleetUi ? String(fleetUi.idle) : '—'}</Text>
              <Text style={st.fleetItemLab}>Nghỉ</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('./vehicles')}
            style={({ pressed }) => [st.linkDrivers, pressed && { opacity: 0.85 }]}>
            <Text style={st.linkDriversText}>Quản lý phương tiện</Text>
            <MaterialIcons name="chevron-right" size={20} color={S.primary} />
          </Pressable>
        </View>

        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Tài xế tiêu biểu</Text>
          {topDriverUi ? (
            <View style={st.driverCardInner}>
              <View style={st.avatar}>
                <Text style={st.avatarTxt}>{topDriverUi.initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.topDriverName}>{topDriverUi.name}</Text>
                {topDriverUi.tier ? (
                  <View style={st.tierRow}>
                    <MaterialIcons name="star" size={16} color="#b8860b" />
                    <Text style={st.tierText}>{topDriverUi.tier}</Text>
                  </View>
                ) : null}
                <View style={st.topStats}>
                  <View>
                    <Text style={st.topStatLab}>Chuyến</Text>
                    <Text style={st.topStatVal}>
                      {topDriverUi.deliveries != null ? String(topDriverUi.deliveries) : '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={st.topStatLab}>
                      {topDriverUi.rating != null ? 'Đánh giá' : 'Doanh thu'}
                    </Text>
                    <Text style={st.topStatVal}>
                      {topDriverUi.rating != null
                        ? `${topDriverUi.rating.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/5`
                        : topDriverUi.revenue != null
                          ? `${formatVndCompact(topDriverUi.revenue)} VND`
                          : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <Text style={st.chartFallbackHint}>Chưa có dữ liệu tài xế.</Text>
          )}
          <Pressable
            onPress={() => router.push('/drivers')}
            style={({ pressed }) => [st.linkDrivers, pressed && { opacity: 0.85 }]}>
            <Text style={st.linkDriversText}>Xem tất cả tài xế</Text>
            <MaterialIcons name="chevron-right" size={20} color={S.primary} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/receipt/form')}
          style={({ pressed }) => [st.manifestBtn, pressed && { opacity: 0.92 }]}>
          <MaterialIcons name="add-circle" size={22} color="#fff" />
          <Text style={st.manifestBtnText}>Tạo phiếu cân</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  scrollPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topBarAppIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  topBarHello: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Brand.ink,
    flex: 1,
    minWidth: 0,
  },
  demoHint: {
    fontSize: 11,
    color: `${S.outline}b3`,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  summaryLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryLoadingTxt: {
    fontSize: 13,
    color: S.onSurfaceVariant,
  },
  chartFallbackHint: {
    fontSize: 12,
    color: `${S.outline}b3`,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}aa`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    minWidth: 156,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Brand.ink,
  },
  tileSub: {
    marginTop: 4,
    fontSize: 11,
    color: `${S.outline}b3`,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: `${S.primary}28`,
    borderLeftWidth: 4,
    borderLeftColor: S.primary,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  pendingIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconImg: {
    width: 58,
    height: 58,
  },
  pendingBody: {
    flex: 1,
    minWidth: 0,
  },
  pendingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 4,
  },
  pendingSub: {
    fontSize: 13,
    lineHeight: 19,
    color: S.onSurfaceVariant,
    marginBottom: 10,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingCount: {
    fontSize: 15,
    fontWeight: '800',
    color: S.primary,
  },
  sectionCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}99`,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 10,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: S.onSurfaceVariant,
    marginBottom: 16,
  },
  chartWrap: {
    marginHorizontal: -4,
    alignItems: 'center',
  },
  chartAxisText: {
    fontSize: 11,
    color: S.onSurfaceVariant,
  },
  fleetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  fleetRatio: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.5,
  },
  fleetCap: {
    fontSize: 13,
    color: S.onSurfaceVariant,
  },
  fleetBreak: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
    paddingTop: 14,
  },
  fleetItem: {
    flex: 1,
    alignItems: 'center',
  },
  fleetItemVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.ink,
  },
  fleetItemLab: {
    fontSize: 12,
    color: S.onSurfaceVariant,
    marginTop: 4,
  },
  driverCardInner: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: S.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 20,
    fontWeight: '800',
    color: S.onSecondaryContainer,
  },
  topDriverName: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 12,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b8860b',
  },
  topStats: {
    flexDirection: 'row',
    gap: 28,
  },
  topStatLab: {
    fontSize: 11,
    color: S.onSurfaceVariant,
    marginBottom: 2,
  },
  topStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
  },
  linkDrivers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
  },
  linkDriversText: {
    fontSize: 14,
    fontWeight: '700',
    color: S.primary,
  },
  manifestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: S.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  manifestBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

const qa = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 6,
  },
  iconWrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  icon: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.ink,
    lineHeight: 14,
    textAlign: 'center',
  },
});
