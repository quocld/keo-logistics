import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
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
import {
  aggregateCostTotals,
  buildDailyChartBars,
  chartMaxValue,
  formatSignedPercent,
  marginPercentAfterOperatingFromSummary,
  operatingCostTotalFromSummary,
  pendingReceiptsCountFromSummary,
  profitAfterOperatingFromSummary,
  profitFromSummary,
  revenueFromSummary,
  topDriverFromSummary,
  totalWeightFromSummary,
  trendFromPercent,
  type ChartBarWithCosts,
} from '@/lib/analytics/owner-home-map';
import { getDashboardSummary, getFinanceReport } from '@/lib/api/analytics';
import { formatVndShortVi } from '@/lib/format/vnd-vi';
import type { FinanceReportResponse, HarvestAreaSummaryItem, OwnerDashboardSummary } from '@/lib/types/analytics';

const S = Brand.stitch;

type PeriodKey = 'thisMonth' | 'lastMonth' | 'custom';
type Trend = 'up' | 'down' | 'neutral';

// ─── StatTile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  subLabel,
  trend,
  trendLabel,
  variant = 'default',
  compact,
  valueLoading,
}: {
  label: string;
  value: string;
  subLabel?: string;
  trend?: Trend;
  trendLabel?: string;
  variant?: 'hero' | 'default';
  compact?: boolean;
  valueLoading?: boolean;
}) {
  const trendColor =
    trend === 'up' ? S.primary : trend === 'down' ? '#c62828' : S.onSurfaceVariant;
  const hero = variant === 'hero';
  const isCompact = Boolean(compact && !hero);
  return (
    <View style={[st.tile, hero && st.tileHero, isCompact && st.tileCompact]}>
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
        <View style={[st.tileValueLoading, hero && st.tileValueLoadingHero]}>
          <ActivityIndicator size="small" color={S.primary} />
        </View>
      ) : (
        <Text style={[st.tileValue, hero && st.tileValueHero, isCompact && st.tileValueCompact]} numberOfLines={2}>
          {value}
        </Text>
      )}
      {!isCompact && subLabel && !valueLoading ? (
        <Text style={[st.tileSub, hero && st.tileSubHero]} numberOfLines={2}>
          {subLabel}
        </Text>
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
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function prevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function computeRangeParams(
  period: PeriodKey,
  customFrom: Date | null,
  customTo: Date | null,
): { range: string; from?: string; to?: string } {
  if (period === 'thisMonth') {
    return { range: 'month' };
  }
  if (period === 'lastMonth') {
    const now = new Date();
    const prev = prevMonth(now);
    return {
      range: 'custom',
      from: localDateYmd(firstDayOfMonth(prev)),
      to: localDateYmd(lastDayOfMonth(prev)),
    };
  }
  // custom
  if (customFrom && customTo) {
    return {
      range: 'custom',
      from: localDateYmd(customFrom),
      to: localDateYmd(customTo),
    };
  }
  return { range: 'month' };
}

function marginColor(pct: number | null): string {
  if (pct == null) return S.onSurfaceVariant;
  if (pct >= 20) return Brand.forest;
  if (pct >= 10) return '#874e00';
  return '#c62828';
}

function areaName(item: HarvestAreaSummaryItem): string {
  return (typeof item.name === 'string' && item.name.trim()) || `Khu #${item.harvestAreaId ?? '?'}`;
}

// ─── DateRangePicker modal ────────────────────────────────────────────────────

type DatePickerStep = 'from' | 'to';

function DateRangePickerModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (from: Date, to: Date) => void;
}) {
  const [step, setStep] = useState<DatePickerStep>('from');
  const [fromDate, setFromDate] = useState<Date>(firstDayOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date>(new Date());

  const maxTo = useMemo(() => {
    const max = new Date(fromDate);
    max.setDate(fromDate.getDate() + 30);
    return max;
  }, [fromDate]);

  const handleFromChange = (_: unknown, selected: Date | undefined) => {
    if (!selected) return;
    setFromDate(selected);
    if (Platform.OS === 'android') {
      setStep('to');
    }
  };

  const handleToChange = (_: unknown, selected: Date | undefined) => {
    if (!selected) return;
    const clamped = selected > maxTo ? maxTo : selected;
    setToDate(clamped);
    if (Platform.OS === 'android') {
      onConfirm(fromDate, clamped);
      onClose();
    }
  };

  const handleNextStep = () => {
    if (step === 'from') setStep('to');
    else {
      onConfirm(fromDate, toDate);
      onClose();
    }
  };

  const handleBack = () => {
    if (step === 'to') setStep('from');
    else onClose();
  };

  if (Platform.OS === 'android') {
    if (!visible) return null;
    if (step === 'from') {
      return (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleFromChange}
        />
      );
    }
    return (
      <DateTimePicker
        value={toDate}
        mode="date"
        display="default"
        minimumDate={fromDate}
        maximumDate={maxTo}
        onChange={handleToChange}
      />
    );
  }

  // iOS: spinner inside modal
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={dp.overlay} onPress={onClose}>
        <Pressable style={dp.sheet} onPress={() => {}}>
          <Text style={dp.title}>{step === 'from' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}</Text>
          {step === 'from' ? (
            <DateTimePicker
              value={fromDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={handleFromChange}
              style={dp.picker}
            />
          ) : (
            <DateTimePicker
              value={toDate}
              mode="date"
              display="spinner"
              minimumDate={fromDate}
              maximumDate={maxTo}
              onChange={handleToChange}
              style={dp.picker}
            />
          )}
          <View style={dp.btnRow}>
            <Pressable onPress={handleBack} style={({ pressed }) => [dp.btn, pressed && { opacity: 0.75 }]}>
              <Text style={dp.btnSecText}>{step === 'from' ? 'Huỷ' : 'Quay lại'}</Text>
            </Pressable>
            <Pressable onPress={handleNextStep} style={({ pressed }) => [dp.btn, dp.btnPrimary, pressed && { opacity: 0.85 }]}>
              <Text style={dp.btnPrimText}>{step === 'from' ? 'Tiếp' : 'Xem thống kê'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── CostBar ─────────────────────────────────────────────────────────────────

function CostBar({
  label,
  amount,
  totalCost,
  color,
}: {
  label: string;
  amount: number;
  totalCost: number;
  color: string;
}) {
  const pct = totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0;
  return (
    <View style={cb.row}>
      <Text style={cb.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={cb.barTrack}>
        <View style={[cb.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={cb.pct}>{pct}%</Text>
      <Text style={cb.amount} numberOfLines={1}>
        {formatVndShortVi(amount)}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [period, setPeriod] = useState<PeriodKey>('thisMonth');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeBody, setFinanceBody] = useState<FinanceReportResponse | null>(null);
  const [financeFailed, setFinanceFailed] = useState(false);

  const loadData = useCallback(
    async (p: PeriodKey, cFrom: Date | null, cTo: Date | null) => {
      if (!isOwner) return;
      const params = computeRangeParams(p, cFrom, cTo);
      setSummaryLoading(true);
      setFinanceLoading(true);
      setSummaryFailed(false);
      setFinanceFailed(false);
      try {
        const [sumRes, finRes] = await Promise.all([
          getDashboardSummary(params),
          getFinanceReport({ ...params, groupBy: 'day' }),
        ]);
        if (sumRes.ok) {
          setSummary(sumRes.body);
        } else {
          setSummary(null);
          setSummaryFailed(true);
        }
        if (finRes.ok) {
          setFinanceBody(finRes.body);
        } else {
          setFinanceBody(null);
          setFinanceFailed(true);
        }
      } catch {
        setSummary(null);
        setSummaryFailed(true);
        setFinanceBody(null);
        setFinanceFailed(true);
      } finally {
        setSummaryLoading(false);
        setFinanceLoading(false);
      }
    },
    [isOwner],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(period, customFrom, customTo);
    }, [loadData, period, customFrom, customTo]),
  );

  const selectPeriod = (p: PeriodKey) => {
    if (p === 'custom') {
      setShowDatePicker(true);
      return;
    }
    setPeriod(p);
  };

  const handleCustomConfirm = (from: Date, to: Date) => {
    setCustomFrom(from);
    setCustomTo(to);
    setPeriod('custom');
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const revNum = summary ? revenueFromSummary(summary) : null;
  const profitNum = summary ? profitAfterOperatingFromSummary(summary) ?? profitFromSummary(summary) : null;
  const weightNum = summary ? totalWeightFromSummary(summary) : null;
  const pendingCount = summary ? pendingReceiptsCountFromSummary(summary) : null;
  const marginPct = summary ? marginPercentAfterOperatingFromSummary(summary) ?? (summary.marginPercent ?? null) : null;
  const opCost = summary ? operatingCostTotalFromSummary(summary) : null;

  const revTrendLabel = formatSignedPercent(summary?.revenueTrendPercent);
  const revTrend = trendFromPercent(summary?.revenueTrendPercent);
  const profitTrend = trendFromPercent(summary?.profitTrendPercent);
  const profitTrendLabel = formatSignedPercent(summary?.profitTrendPercent);

  const costTotals = useMemo(() => aggregateCostTotals(financeBody), [financeBody]);
  const totalCost = costTotals.driver + costTotals.harvest + costTotals.other + costTotals.operating;

  const dailyBars = useMemo<ChartBarWithCosts[]>(() => {
    if (financeLoading) return [];
    return buildDailyChartBars(financeBody);
  }, [financeBody, financeLoading]);

  const chartMax = chartMaxValue(dailyBars.length > 0 ? dailyBars : []);

  const chartWidth = Math.max(260, windowWidth - 40 - 36);

  const financeChartData = useMemo(() => {
    if (!dailyBars.length) return [];
    const barW = 10;
    return dailyBars.flatMap((d) => [
      {
        value: d.value,
        label: d.label,
        barWidth: barW,
        frontColor: Brand.forest,
        showGradient: true,
        gradientColor: `${Brand.forest}55`,
        spacing: 2,
      },
      {
        value: d.cost,
        label: '',
        barWidth: barW,
        frontColor: '#e05c2a',
        showGradient: true,
        gradientColor: '#e05c2a55',
        spacing: 4,
      },
    ]);
  }, [dailyBars]);

  const harvestAreas: HarvestAreaSummaryItem[] = useMemo(() => {
    const areas = summary?.harvestAreaSummaries;
    if (!Array.isArray(areas)) return [];
    return areas;
  }, [summary]);

  const topDrivers = useMemo(() => {
    const drivers = summary?.topDrivers;
    if (!Array.isArray(drivers)) return [];
    return drivers.slice(0, 5).map((d) => topDriverFromSummary(d)).filter(Boolean);
  }, [summary]);

  const isLoading = summaryLoading || financeLoading;

  if (!isOwner) {
    return (
      <View style={[os.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={st.errorHint}>Chức năng này chỉ dành cho chủ.</Text>
      </View>
    );
  }

  return (
    <View style={os.root}>
      {/* Header */}
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <Text style={st.headerTitle}>Thống kê</Text>
      </View>
      <View style={os.hairline} />

      {/* Period selector — sticky */}
      <View style={st.periodBar}>
        {(['thisMonth', 'lastMonth', 'custom'] as PeriodKey[]).map((p) => {
          const active = period === p;
          const label = p === 'thisMonth' ? 'Tháng này' : p === 'lastMonth' ? 'Tháng trước' : 'Tùy chọn';
          return (
            <Pressable
              key={p}
              onPress={() => selectPeriod(p)}
              style={({ pressed }) => [st.periodBtn, active && st.periodBtnActive, pressed && { opacity: 0.8 }]}>
              <Text style={[st.periodBtnText, active && st.periodBtnTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={os.flatListFlex}
        contentContainerStyle={[st.scrollPad, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}>

        {(summaryFailed || financeFailed) && !isLoading ? (
          <Text style={st.errorHint}>Không tải được dữ liệu — thử lại bằng cách đổi kỳ hoặc kéo xuống.</Text>
        ) : null}

        {/* KPI 2×2 */}
        <View style={st.statGrid}>
          <StatTile
            variant="hero"
            label="Doanh thu"
            value={revNum != null ? formatVndShortVi(revNum) : '—'}
            valueLoading={summaryLoading}
            trend={revTrendLabel ? revTrend : undefined}
            trendLabel={revTrendLabel ?? undefined}
          />
          <StatTile
            variant="hero"
            label="Lợi nhuận"
            value={profitNum != null ? formatVndShortVi(profitNum) : '—'}
            valueLoading={summaryLoading}
            subLabel={marginPct != null ? `Biên: ${marginPct.toFixed(1)}%` : undefined}
            trend={profitTrendLabel ? profitTrend : undefined}
            trendLabel={profitTrendLabel ?? undefined}
          />
          <StatTile
            compact
            label="Tổng tấn"
            value={weightNum != null ? `${weightNum.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tấn` : '—'}
            valueLoading={summaryLoading}
          />
          <StatTile
            compact
            label="Phiếu chờ"
            value={pendingCount != null ? String(pendingCount) : '—'}
            valueLoading={summaryLoading}
          />
        </View>

        {/* Chart: doanh thu theo ngày */}
        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Doanh thu theo ngày</Text>
          <View style={st.chartLegend}>
            <View style={st.legendDot} />
            <Text style={st.legendText}>Doanh thu</Text>
            <View style={[st.legendDot, { backgroundColor: '#e05c2a' }]} />
            <Text style={st.legendText}>Chi phí</Text>
          </View>
          {financeFailed && !financeLoading ? (
            <Text style={st.errorHint}>Không tải được dữ liệu biểu đồ.</Text>
          ) : null}
          <View style={st.chartWrap}>
            {financeLoading ? (
              <View style={st.chartLoading}>
                <ActivityIndicator size="small" color={S.primary} />
              </View>
            ) : financeChartData.length === 0 ? (
              <Text style={st.emptyHint}>Không có dữ liệu trong kỳ này.</Text>
            ) : (
              <BarChart
                data={financeChartData}
                width={chartWidth}
                height={200}
                barWidth={10}
                spacing={2}
                roundedTop
                roundedBottom
                isAnimated
                animationDuration={500}
                noOfSections={4}
                maxValue={chartMax}
                yAxisExtraHeight={24}
                hideRules={false}
                rulesType="solid"
                rulesColor={`${S.outline}33`}
                rulesThickness={StyleSheet.hairlineWidth}
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisColor="transparent"
                yAxisTextStyle={st.chartAxisText}
                xAxisLabelTextStyle={st.chartAxisText}
                initialSpacing={4}
                endSpacing={4}
              />
            )}
          </View>
        </View>

        {/* Phân bổ chi phí */}
        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Phân bổ chi phí</Text>
          {financeLoading ? (
            <ActivityIndicator size="small" color={S.primary} style={{ marginVertical: 24 }} />
          ) : totalCost === 0 ? (
            <Text style={st.emptyHint}>Không có dữ liệu chi phí trong kỳ này.</Text>
          ) : (
            <>
              {opCost != null && opCost > 0 ? (
                <Text style={st.costSubtitle}>
                  Chi phí vận hành: {formatVndShortVi(opCost)}
                </Text>
              ) : null}
              <CostBar label="Tài xế" amount={costTotals.driver} totalCost={totalCost} color={S.primary} />
              <CostBar label="Khai thác" amount={costTotals.harvest} totalCost={totalCost} color={Brand.emerald} />
              <CostBar label="Khác" amount={costTotals.other} totalCost={totalCost} color={S.tertiary} />
              <CostBar label="Vận hành" amount={costTotals.operating} totalCost={totalCost} color={S.outline} />
            </>
          )}
        </View>

        {/* Khu khai thác */}
        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Khu khai thác</Text>
          {summaryLoading ? (
            <ActivityIndicator size="small" color={S.primary} style={{ marginVertical: 24 }} />
          ) : harvestAreas.length === 0 ? (
            <Text style={st.emptyHint}>Không có dữ liệu khu khai thác.</Text>
          ) : (
            <>
              <View style={ar.headerRow}>
                <Text style={[ar.col1, ar.headerText]}>Khu</Text>
                <Text style={[ar.col2, ar.headerText]}>Doanh thu</Text>
                <Text style={[ar.col2, ar.headerText]}>Lợi nhuận</Text>
                <Text style={[ar.col3, ar.headerText]}>Biên</Text>
              </View>
              {harvestAreas.map((item, idx) => {
                const rev = typeof item.revenue === 'number' ? item.revenue : null;
                const prof =
                  typeof item.profitAfterOperatingCosts === 'number'
                    ? item.profitAfterOperatingCosts
                    : typeof item.profit === 'number'
                      ? item.profit
                      : null;
                const pct = typeof item.marginPercent === 'number' ? item.marginPercent : null;
                return (
                  <View key={idx} style={[ar.row, idx % 2 === 1 && ar.rowAlt]}>
                    <Text style={[ar.col1, ar.cellText]} numberOfLines={2}>
                      {areaName(item)}
                    </Text>
                    <Text style={[ar.col2, ar.cellText]} numberOfLines={1}>
                      {rev != null ? formatVndShortVi(rev) : '—'}
                    </Text>
                    <Text style={[ar.col2, ar.cellText]} numberOfLines={1}>
                      {prof != null ? formatVndShortVi(prof) : '—'}
                    </Text>
                    <Text style={[ar.col3, ar.cellText, { color: marginColor(pct), fontWeight: '700' }]} numberOfLines={1}>
                      {pct != null ? `${pct.toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Top tài xế */}
        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>Top tài xế</Text>
          {summaryLoading ? (
            <ActivityIndicator size="small" color={S.primary} style={{ marginVertical: 24 }} />
          ) : topDrivers.length === 0 ? (
            <Text style={st.emptyHint}>Chưa có dữ liệu tài xế.</Text>
          ) : (
            topDrivers.map((d, idx) => {
              if (!d) return null;
              return (
                <View key={idx} style={dr.row}>
                  <View style={dr.rankWrap}>
                    <Text style={dr.rank}>#{idx + 1}</Text>
                  </View>
                  <View style={dr.avatar}>
                    <Text style={dr.avatarTxt}>{d.initial}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={dr.name} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={dr.sub} numberOfLines={1}>
                      {d.deliveries != null ? `${d.deliveries} chuyến` : ''}
                      {d.revenue != null ? `  ·  ${formatVndShortVi(d.revenue)}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handleCustomConfirm}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.3,
  },
  periodBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Brand.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${Brand.stitch.outlineVariant}88`,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: Brand.stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodBtnActive: {
    backgroundColor: `${Brand.stitch.primary}14`,
    borderColor: `${Brand.stitch.primary}60`,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.stitch.onSurfaceVariant,
  },
  periodBtnTextActive: {
    color: Brand.stitch.primary,
    fontWeight: '700',
  },
  scrollPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  errorHint: {
    fontSize: 12,
    color: '#c62828',
    marginBottom: 14,
    fontStyle: 'italic',
  },
  emptyHint: {
    fontSize: 12,
    color: `${Brand.stitch.outline}b3`,
    marginVertical: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  tile: {
    width: '48%',
    maxWidth: '48%',
    flexGrow: 1,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${Brand.stitch.outlineVariant}aa`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    minWidth: 148,
  },
  tileHero: {
    backgroundColor: `${Brand.stitch.primary}12`,
    borderWidth: 1.5,
    borderColor: `${Brand.forest}40`,
  },
  tileCompact: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tileLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tileLabelRowCompact: {
    marginBottom: 4,
    alignItems: 'center',
  },
  tileLabelCompact: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.stitch.onSurfaceVariant,
    lineHeight: 15,
  },
  tileLabelHint: {
    fontWeight: '500',
    color: `${Brand.stitch.onSurfaceVariant}aa`,
  },
  tileLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.stitch.onSurfaceVariant,
  },
  tileLabelHero: {
    color: Brand.stitch.primary,
    fontWeight: '700',
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Brand.ink,
  },
  tileValueHero: {
    fontSize: 20,
    color: Brand.stitch.primary,
  },
  tileValueCompact: {
    fontSize: 18,
    marginTop: 2,
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
  tileSub: {
    marginTop: 4,
    fontSize: 11,
    color: `${Brand.stitch.outline}b3`,
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
  sectionCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${Brand.stitch.outlineVariant}99`,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 12,
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
    color: Brand.stitch.onSurfaceVariant,
    marginRight: 10,
  },
  chartWrap: {
    marginHorizontal: -4,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  chartLoading: {
    paddingVertical: 48,
  },
  chartAxisText: {
    fontSize: 10,
    color: `${Brand.stitch.onSurfaceVariant}cc`,
    fontWeight: '500',
  },
  costSubtitle: {
    fontSize: 12,
    color: Brand.stitch.onSurfaceVariant,
    marginBottom: 12,
  },
});

const cb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    width: 70,
    fontSize: 13,
    color: Brand.stitch.onSurfaceVariant,
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: `${Brand.stitch.outlineVariant}55`,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  pct: {
    width: 32,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'right',
  },
  amount: {
    width: 64,
    fontSize: 11,
    color: Brand.stitch.onSurfaceVariant,
    textAlign: 'right',
  },
});

const ar = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.stitch.outlineVariant,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
  },
  rowAlt: {
    backgroundColor: Brand.stitch.surfaceContainerLow,
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  col1: {
    flex: 2,
    minWidth: 0,
  },
  col2: {
    flex: 2,
    minWidth: 0,
  },
  col3: {
    width: 52,
    textAlign: 'right',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.stitch.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cellText: {
    fontSize: 13,
    color: Brand.ink,
    fontWeight: '500',
  },
});

const dr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${Brand.stitch.outlineVariant}55`,
  },
  rankWrap: {
    width: 28,
    alignItems: 'center',
  },
  rank: {
    fontSize: 14,
    fontWeight: '800',
    color: Brand.stitch.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.stitch.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.stitch.onSecondaryContainer,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.ink,
  },
  sub: {
    fontSize: 12,
    color: Brand.stitch.onSurfaceVariant,
    marginTop: 2,
  },
});

const dp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  picker: {
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Brand.stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Brand.stitch.outlineVariant,
  },
  btnPrimary: {
    backgroundColor: Brand.stitch.primary,
    borderColor: Brand.stitch.primary,
  },
  btnSecText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.stitch.onSurfaceVariant,
  },
  btnPrimText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
