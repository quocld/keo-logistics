import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { listReceipts } from '@/lib/api/receipts';

const S = Brand.stitch;

const WEEKDAYS_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function displayName(user: { firstName: string | null; lastName: string | null; email: string }): string {
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

function formatVndCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('vi-VN');
}

type Trend = 'up' | 'down' | 'neutral';

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

/** Demo 7 ngày — thay bằng series từ API dashboard */
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

  useFocusEffect(
    useCallback(() => {
      void loadPending();
    }, [loadPending]),
  );

  const greeting = user ? displayName(user) : 'bạn';
  const todayLine = useMemo(() => formatTodayVi(new Date()), []);

  const performanceChartWidth = Math.max(260, windowWidth - 40 - 36);

  /** Minh họa UI theo Stitch — thay bằng API tổng hợp khi backend có dashboard */
  const demoRevenue = 28_500_000;
  const demoProfit = 10_200_000;
  const demoWeight = 124.5;
  const demoMargin = 18.2;

  const pendingLine =
    pendingCount == null
      ? '—'
      : pendingHasMore && pendingCount >= 50
        ? `${pendingCount}+`
        : String(pendingCount);

  if (!isOwner) {
    return (
      <View style={os.root}>
        <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={os.topBarLeft}>
            <MaterialIcons name="eco" size={26} color={Brand.forest} />
            <Text style={os.topTitleStitch} numberOfLines={1}>
              KeoTram
            </Text>
          </View>
          <View style={os.topBarRight}>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
              <MaterialIcons name="settings" size={24} color={S.onSurfaceVariant} />
            </Pressable>
          </View>
        </View>
        <View style={os.hairline} />
        <ScrollView
          style={os.flatListFlex}
          contentContainerStyle={[st.scrollPad, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={st.driverGreet}>
            {greetingByHour()}, {greeting}
          </Text>
          <Text style={st.dateMuted}>{todayLine}</Text>
          <Text style={st.driverHint}>
            Bạn đang dùng tài khoản tài xế. Trang tổng quan đầy đủ dành cho chủ vườn; dùng tab khác để thao tác theo
            quyền của bạn.
          </Text>
          <Pressable onPress={() => router.push('/settings')} style={st.driverBtn}>
            <Text style={st.driverBtnText}>Cài đặt & đăng xuất</Text>
            <MaterialIcons name="chevron-right" size={22} color={S.primary} />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <MaterialIcons name="eco" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            KeoTram Ops
          </Text>
        </View>
        <View style={os.topBarRight}>
          <Pressable style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]} hitSlop={8}>
            <MaterialIcons name="notifications-none" size={24} color={S.onSurfaceVariant} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}
            accessibilityLabel="Cài đặt">
            <MaterialIcons name="settings" size={24} color={S.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
      <View style={os.hairline} />

      <ScrollView
        style={os.flatListFlex}
        contentContainerStyle={[st.scrollPad, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={st.heroGreet}>
          {greetingByHour()}, {greeting}
        </Text>
        <Text style={st.dateMuted}>{todayLine}</Text>

        <Text style={st.demoHint}>Số liệu ô tổng quan minh họa — đồng bộ API sau</Text>

        <View style={st.statGrid}>
          <StatTile
            label="Doanh thu hôm nay"
            value={`${formatVndCompact(demoRevenue)} VND`}
            trend="up"
            trendLabel="12%"
          />
          <StatTile
            label="Lợi nhuận"
            value={`${formatVndCompact(demoProfit)} VND`}
            trend="up"
            trendLabel="8%"
          />
          <StatTile label="Tổng khối lượng" value={`${demoWeight} tấn`} subLabel="Trung bình ngày" />
          <StatTile
            label="Biên lợi nhuận"
            value={`${demoMargin}%`}
            trend="down"
            trendLabel="0,5%"
          />
        </View>

        <Pressable
          onPress={() => router.push('/receipt-approval')}
          style={({ pressed }) => [st.pendingCard, pressed && { opacity: 0.96 }]}>
          <View style={st.pendingIcon}>
            <MaterialIcons name="fact-check" size={26} color={S.primary} />
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
            Tăng trưởng vận tải trong 30 ngày qua đạt mức ổn định 14%. Theo dõi xu hướng khi dashboard API sẵn sàng.
          </Text>
          <View style={st.chartWrap}>
            <BarChart
              data={DEMO_PERFORMANCE_BARS.map((d) => ({
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
              maxValue={100}
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
              <Text style={st.fleetRatio}>12/15</Text>
              <Text style={st.fleetCap}>Xe đang hoạt động</Text>
            </View>
          </View>
          <View style={st.fleetBreak}>
            <View style={st.fleetItem}>
              <Text style={st.fleetItemVal}>12</Text>
              <Text style={st.fleetItemLab}>Đang chạy</Text>
            </View>
            <View style={st.fleetItem}>
              <Text style={st.fleetItemVal}>2</Text>
              <Text style={st.fleetItemLab}>Bảo trì</Text>
            </View>
            <View style={st.fleetItem}>
              <Text style={st.fleetItemVal}>1</Text>
              <Text style={st.fleetItemLab}>Nghỉ</Text>
            </View>
          </View>
        </View>

        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Tài xế tiêu biểu</Text>
          <View style={st.driverCardInner}>
            <View style={st.avatar}>
              <Text style={st.avatarTxt}>N</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.topDriverName}>Trần Văn Nam</Text>
              <View style={st.tierRow}>
                <MaterialIcons name="star" size={16} color="#b8860b" />
                <Text style={st.tierText}>Hạng Bạch kim</Text>
              </View>
              <View style={st.topStats}>
                <View>
                  <Text style={st.topStatLab}>Chuyến</Text>
                  <Text style={st.topStatVal}>48</Text>
                </View>
                <View>
                  <Text style={st.topStatLab}>Đánh giá</Text>
                  <Text style={st.topStatVal}>4,9/5,0</Text>
                </View>
              </View>
            </View>
          </View>
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
  heroGreet: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Brand.ink,
    marginBottom: 6,
  },
  dateMuted: {
    fontSize: 14,
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  demoHint: {
    fontSize: 11,
    color: `${S.outline}b3`,
    marginBottom: 16,
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
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${S.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
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
  driverGreet: {
    fontSize: 22,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 6,
  },
  driverHint: {
    fontSize: 15,
    lineHeight: 22,
    color: S.onSurfaceVariant,
    marginTop: 20,
    marginBottom: 20,
  },
  driverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}aa`,
  },
  driverBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
  },
});
