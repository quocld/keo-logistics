import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  revenueFromSummary,
  topDriverFromSummary,
  totalWeightFromSummary,
  trendFromPercent,
  type ChartBarWithCosts,
} from '@/lib/analytics/owner-home-map';
import { getDashboardSummary, getFinanceReportLast7Days } from '@/lib/api/analytics';
import { listHarvestAreas } from '@/lib/api/harvest-areas';
import { listReceipts } from '@/lib/api/receipts';
import { formatVndMiniChart, formatVndShortVi } from '@/lib/format/vnd-vi';
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
  moreLink,
  variant = 'default',
  compact,
  valueLoading,
  style,
}: {
  label: string;
  value: string;
  subLabel?: string;
  trend?: Trend;
  trendLabel?: string;
  moreLink?: { label: string; onPress: () => void };
  /** Doanh thu / khối lượng — nền và chữ nổi bật */
  variant?: 'hero' | 'default';
  /** Ô nhỏ gọn: ít padding, gộp chú thích vào tiêu đề */
  compact?: boolean;
  /** Chỉ thay số liệu bằng spinner — giữ layout ô cố định */
  valueLoading?: boolean;
  style?: object;
}) {
  const trendColor =
    trend === 'up' ? S.primary : trend === 'down' ? '#c62828' : S.onSurfaceVariant;
  const hero = variant === 'hero';
  const isCompact = Boolean(compact && !hero);
  return (
    <View style={[st.tile, hero && st.tileHero, isCompact && st.tileCompact, style]}>
      <View>
        <View style={[st.tileLabelRow, isCompact && st.tileLabelRowCompact]}>
          {isCompact ? (
            <Text style={st.tileLabelCompact} numberOfLines={2}>
              {label}
              {subLabel ? <Text style={st.tileLabelHint}> · {subLabel}</Text> : null}
            </Text>
          ) : (
            <Text style={[st.tileLabel, hero && st.tileLabelHero]} numberOfLines={2}>
              {label}
            </Text>
          )}
        </View>
        {valueLoading ? (
          <View
            style={[
              st.tileValueLoading,
              hero && st.tileValueLoadingHero,
              isCompact && st.tileValueLoadingCompact,
            ]}>
            <ActivityIndicator size="small" color={S.primary} />
          </View>
        ) : (
          <Text
            style={[st.tileValue, hero && st.tileValueHero, isCompact && st.tileValueCompact]}
            numberOfLines={2}>
            {value}
          </Text>
        )}
        {!isCompact && subLabel ? (
          valueLoading ? (
            <View style={st.tileSubLoading}>
              <ActivityIndicator size="small" color={`${S.primary}99`} />
            </View>
          ) : (
            <Text style={[st.tileSub, hero && st.tileSubHero]} numberOfLines={2}>
              {subLabel}
            </Text>
          )
        ) : null}
        {!valueLoading && trend && trendLabel ? (
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
      {moreLink ? (
        <Pressable
          onPress={moreLink.onPress}
          style={({ pressed }) => [
            st.tileMoreRow,
            isCompact && st.tileMoreRowCompact,
            pressed && { opacity: 0.82 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={moreLink.label}>
          <Text style={[st.tileMoreText, isCompact && st.tileMoreTextCompact, isCompact && st.tileMoreTextFill]}>
            {moreLink.label}
          </Text>
          <MaterialIcons name="chevron-right" size={isCompact ? 16 : 18} color={S.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Ngày hiện tại theo máy (YYYY-MM-DD) cho filter API phiếu. */
function localDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


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
  const [performanceBars, setPerformanceBars] = useState<ChartBarWithCosts[] | null>(null);
  const [financeReportFailed, setFinanceReportFailed] = useState(false);

  const [approvedTodayCount, setApprovedTodayCount] = useState<number | null>(null);
  const [approvedTodayHasMore, setApprovedTodayHasMore] = useState(false);
  const [activeHarvestCount, setActiveHarvestCount] = useState<number | null>(null);
  const [activeHarvestHasMore, setActiveHarvestHasMore] = useState(false);

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
    const todayYmd = localDateYmd(new Date());
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
        setPerformanceBars(buildPerformanceBarsFromFinanceReport(finRes.body));
        setFinanceReportFailed(false);
      } else {
        setPerformanceBars(null);
        setFinanceReportFailed(true);
      }
    } catch {
      setSummary(null);
      setSummaryFailed(true);
      setPerformanceBars(null);
      setFinanceReportFailed(true);
    }

    try {
      const approvedRes = await listReceipts({
        page: 1,
        limit: 100,
        status: 'approved',
        receiptDateFrom: todayYmd,
        receiptDateTo: todayYmd,
      });
      if (approvedRes.ok) {
        setApprovedTodayCount(approvedRes.body.data.length);
        setApprovedTodayHasMore(approvedRes.body.hasNextPage);
      } else {
        setApprovedTodayCount(null);
        setApprovedTodayHasMore(false);
      }
    } catch {
      setApprovedTodayCount(null);
      setApprovedTodayHasMore(false);
    }

    try {
      const harvestRes = await listHarvestAreas({ page: 1, limit: 200, filters: { status: 'active' } });
      setActiveHarvestCount(harvestRes.data.length);
      setActiveHarvestHasMore(harvestRes.hasNextPage);
    } catch {
      setActiveHarvestCount(null);
      setActiveHarvestHasMore(false);
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

  // Owner scroll paddingHorizontal = 20, sectionCard paddingHorizontal = 18 => available = window - 40 - 36
  const performanceChartWidth = Math.max(260, Math.floor(windowWidth - 40 - 36));

  // Stats grid: lock to 2 columns on native to avoid Android percent/flexWrap quirks.
  const statGap = 12;
  const statCols = 2;
  const statInnerWidth = Math.max(0, Math.floor(windowWidth - 40)); // scroll paddingHorizontal = 20*2
  const statTileWidth =
    statInnerWidth > 0 ? Math.floor((statInnerWidth - statGap * (statCols - 1)) / statCols) : 0;

  /** Lưới 4 cột: scroll padding 20×2 + card paddingHorizontal 4×2 */
  const quickActionGap = 8;
  const quickActionCols = 4;
  const quickActionsInnerWidth = windowWidth - 40 - 8;
  const quickActionItemWidth =
    (quickActionsInnerWidth - quickActionGap * (quickActionCols - 1)) / quickActionCols;

  const revNum = summary ? revenueFromSummary(summary) : null;
  const weightNum = summary ? totalWeightFromSummary(summary) : null;
  const dailyAvg = summary ? dailyAvgWeightFromSummary(summary) : null;

  const revTrendLabel = formatSignedPercent(summary?.revenueTrendPercent);

  const revTrend = trendFromPercent(summary?.revenueTrendPercent);

  const fleetUi = fleetFromStatus(summary?.fleetStatus);
  const topDriverUi = topDriverFromSummary(summary?.topDrivers?.[0]);

  const chartBarsForRender = useMemo(() => {
    if (summaryLoading) return null;
    if (performanceBars === null) return [];
    return performanceBars;
  }, [summaryLoading, performanceBars]);

  const chartMax = chartMaxValue(
    chartBarsForRender && chartBarsForRender.length > 0 ? chartBarsForRender : [],
  );

  const financeChartData = useMemo(() => {
    const bars = chartBarsForRender && chartBarsForRender.length > 0 ? chartBarsForRender : null;
    if (!bars) return [];
    // Mỗi ngày gồm 2 cột sát nhau (cặp): doanh thu + chi phí.
    // Gap trong cặp nhỏ (1px), gap giữa các cặp lớn hơn để phân biệt nhóm.
    const innerPairGap = 1;
    const interGroupGap = 12;
    const overhead = 12 + bars.length * (innerPairGap + interGroupGap);
    const barW = Math.max(10, Math.floor((performanceChartWidth - overhead) / (bars.length * 2)));
    // Label container đủ rộng để hiện text mà không bị cắt
    const labelW = Math.max(barW + 22, 42);
    const labelOffset = -Math.floor((labelW - barW) / 2);

    return bars.flatMap((d) => [
      // ── Cột doanh thu (trái) ──
      {
        value: d.value,
        label: d.label,
        barWidth: barW,
        frontColor: Brand.forest,
        showGradient: true,
        gradientColor: `${Brand.forest}66`,
        spacing: innerPairGap,
        topLabelComponent: () => (
          <Text style={st.chartBarTopLabel} numberOfLines={1}>
            {formatVndMiniChart(d.value)}
          </Text>
        ),
        topLabelContainerStyle: {
          width: labelW,
          marginLeft: labelOffset,
          alignItems: 'center' as const,
        },
      },
      // ── Cột chi phí (phải) ──
      {
        value: d.cost,
        label: '',
        barWidth: barW,
        frontColor: '#e05c2a',
        showGradient: true,
        gradientColor: '#e05c2a66',
        spacing: interGroupGap,
        topLabelComponent: d.cost > 0
          ? () => (
              <Text style={st.chartBarTopLabelCost} numberOfLines={1}>
                {formatVndMiniChart(d.cost)}
              </Text>
            )
          : undefined,
        topLabelContainerStyle: d.cost > 0
          ? {
              width: labelW,
              marginLeft: labelOffset,
              alignItems: 'center' as const,
            }
          : undefined,
      },
    ]);
  }, [chartBarsForRender, performanceChartWidth]);

  const pendingLine =
    pendingCount == null
      ? '—'
      : pendingHasMore && pendingCount >= 50
        ? `${pendingCount}+`
        : String(pendingCount);

  const approvedTodayLine =
    approvedTodayCount == null
      ? '—'
      : approvedTodayHasMore && approvedTodayCount >= 100
        ? `${approvedTodayCount}+`
        : String(approvedTodayCount);

  const activeHarvestLine =
    activeHarvestCount == null
      ? '—'
      : activeHarvestHasMore && activeHarvestCount >= 200
        ? `${activeHarvestCount}+`
        : String(activeHarvestCount);

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

        <View style={st.statGrid}>
          <StatTile
            variant="hero"
            label="Doanh thu hôm nay"
            value={revNum != null ? formatVndShortVi(revNum) : '—'}
            valueLoading={summaryLoading}
            trend={revTrendLabel ? revTrend : undefined}
            trendLabel={revTrendLabel ?? undefined}
            style={statTileWidth ? { width: statTileWidth } : undefined}
          />
          <StatTile
            variant="hero"
            label="Tổng khối lượng"
            value={weightNum != null ? `${weightNum.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tấn` : '—'}
            valueLoading={summaryLoading}
            subLabel={
              dailyAvg != null
                ? `Trung bình ngày: ${dailyAvg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tấn`
                : 'Trung bình ngày'
            }
            style={statTileWidth ? { width: statTileWidth } : undefined}
          />
          <StatTile
            compact
            label="Phiếu hoàn thành"
            value={approvedTodayLine}
            valueLoading={summaryLoading}
            moreLink={{
              label: 'Danh sách',
              onPress: () => router.push('/receipt-approval?tab=approved' as Href),
            }}
            style={statTileWidth ? { width: statTileWidth } : undefined}
          />
          <StatTile
            compact
            label="Khu hoạt động"
            value={activeHarvestLine}
            valueLoading={summaryLoading}
            moreLink={{
              label: 'Danh sách',
              onPress: () => router.push('/harvest-areas?status=active' as Href),
            }}
            style={statTileWidth ? { width: statTileWidth } : undefined}
          />
        </View>

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
          <Text style={st.sectionTitle}>Doanh thu 7 ngày gần nhất</Text>
          <View style={st.chartLegend}>
            <View style={st.legendDot} />
            <Text style={st.legendText}>Doanh thu</Text>
            <View style={[st.legendDot, { backgroundColor: '#e05c2a' }]} />
            <Text style={st.legendText}>Chi phí</Text>
          </View>
          {financeReportFailed && !summaryLoading ? (
            <Text style={st.demoHint}>Không tải được dữ liệu 7 ngày.</Text>
          ) : null}
          <View style={st.chartWrap}>
            {summaryLoading ? (
              <View style={st.chartLoading}>
                <ActivityIndicator size="small" color={S.primary} />
              </View>
            ) : financeChartData.length === 0 ? null : (
              <BarChart
                data={financeChartData}
                width={performanceChartWidth}
                height={220}
                roundedTop
                roundedBottom
                isAnimated
                animationDuration={550}
                noOfSections={4}
                maxValue={chartMax}
                yAxisExtraHeight={36}
                hideRules={false}
                rulesType="solid"
                rulesColor={`${S.outline}33`}
                rulesThickness={StyleSheet.hairlineWidth}
                dashGap={0}
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisColor="transparent"
                yAxisTextStyle={st.chartAxisText}
                xAxisLabelTextStyle={st.chartAxisText}
                formatYLabel={(val) => formatVndMiniChart(Number(val))}
                disableScroll
                initialSpacing={6}
                endSpacing={6}
              />
            )}
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
                          ? formatVndShortVi(topDriverUi.revenue)
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
  tileValueLoading: {
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  tileValueLoadingHero: {
    minHeight: 32,
    marginTop: 0,
  },
  tileValueLoadingCompact: {
    minHeight: 26,
    marginTop: 2,
  },
  tileSubLoading: {
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 4,
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
    // Use margin-based spacing to be consistent across Android/iOS.
    // "gap" can behave inconsistently depending on RN/renderer.
    marginHorizontal: -6,
    marginBottom: 18,
    alignItems: 'stretch',
  },
  tile: {
    // width is injected at render-time for stable 2-column layout on Android
    marginHorizontal: 6,
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
    justifyContent: 'flex-start',
  },
  tileHero: {
    backgroundColor: `${S.primary}12`,
    borderWidth: 1.5,
    borderColor: `${Brand.forest}40`,
    shadowOpacity: 0.08,
    elevation: 3,
  },
  tileCompact: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tileLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tileLabelRowCompact: {
    marginBottom: 4,
    gap: 6,
    alignItems: 'center',
  },
  tileLabelCompact: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
    color: S.onSurfaceVariant,
    lineHeight: 15,
  },
  tileLabelHint: {
    fontWeight: '500',
    color: `${S.onSurfaceVariant}aa`,
  },
  tileLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  tileLabelHero: {
    color: S.primary,
    fontWeight: '700',
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Brand.ink,
  },
  tileValueCompact: {
    fontSize: 18,
    marginTop: 2,
  },
  tileValueHero: {
    fontSize: 20,
    color: S.primary,
  },
  tileSub: {
    marginTop: 4,
    fontSize: 11,
    color: `${S.outline}b3`,
  },
  tileSubHero: {
    color: '#0a4d2e',
    fontWeight: '600',
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
  tileMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${S.outlineVariant}99`,
    gap: 2,
  },
  tileMoreRowCompact: {
    marginTop: 6,
    paddingTop: 8,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },
  tileMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: S.primary,
  },
  tileMoreTextCompact: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileMoreTextFill: {
    flex: 1,
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
    minHeight: 240,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartLoading: {
    paddingVertical: 48,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  chartEmptyHint: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    marginBottom: 12,
    lineHeight: 19,
  },
  chartBarTopLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0d4a28',
    letterSpacing: -0.2,
  },
  chartBarTopLabelCost: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9c3510',
    letterSpacing: -0.2,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.forest,
  },
  legendText: {
    fontSize: 11,
    color: S.onSurfaceVariant,
    marginRight: 10,
  },
  chartAxisText: {
    fontSize: 10,
    color: `${S.onSurfaceVariant}cc`,
    fontWeight: '500',
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
