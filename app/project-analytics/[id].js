import { useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, formatRupees, formatRupeesShort, CATEGORIES } from '../../src/constants/theme';
import { parseTimestamp } from '../../src/utils/datetime';
import { useAppStore } from '../../src/stores/appStore';

// Which expense category IDs count as direct COGS for interior design
const COGS_IDS = new Set([
  'measurements',
  'construction_material',
  'factory_materials',
  'onsite_materials',
  'jobwork',
  'carpenter',
  'electrician',
  'false_ceiling',
]);

// Colour palette for category bars (cycles)
const PALETTE = [
  '#C9A87C', '#7C9EC9', '#7CC9A8', '#C97C9E',
  '#A87CC9', '#C9C27C', '#7CC4C9', '#C9907C',
  '#9EC97C', '#C97C7C', '#7C90C9', '#C9B07C',
];

function pct(num, denom) {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

function Bar({ value, max, color = theme.colors.primary, height = 6 }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <View style={[styles.barTrack, { height }]}>
      <View style={[styles.barFill, { width: `${w}%`, backgroundColor: color, height, borderRadius: height / 2 }]} />
    </View>
  );
}

function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function PnlRow({ label, value, color, bold, indent, borderTop }) {
  return (
    <View style={[styles.pnlRow, borderTop && styles.pnlRowBorderTop]}>
      <Text style={[styles.pnlLabel, bold && styles.pnlLabelBold, indent && { paddingLeft: 12 }]}>{label}</Text>
      <Text style={[styles.pnlValue, bold && styles.pnlValueBold, color && { color }]}>{formatRupees(value)}</Text>
    </View>
  );
}

function MetricCard({ label, value, subtitle, color }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, color && { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function ProjectAnalyticsScreen() {
  const { id } = useLocalSearchParams();
  const projectId = parseInt(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentProject, messages, loadProject } = useAppStore();

  useFocusEffect(
    useCallback(() => {
      loadProject(projectId).catch(console.error);
    }, [projectId])
  );

  // ── Data derivation ───────────────────────────────────────────────
  const {
    revenue, cogs, grossProfit, grossMargin,
    opex, netProfit, netMargin,
    cogsCategories, opexCategories, incomeCategories,
    topVendors, months, txCount, expCount, incCount,
    avgExpense, largestExpense, totalExpense, budget,
  } = useMemo(() => {
    const txns = (messages || []).filter(m => m.transaction_id);
    const expenses = txns.filter(m => m.transaction_type === 'expense');
    const incomes  = txns.filter(m => m.transaction_type === 'incoming');

    const revenue      = incomes.reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpense = expenses.reduce((s, t) => s + (t.amount || 0), 0);
    const budget       = currentProject?.budget || 0;

    // Split expenses into COGS vs OpEx
    const cogsTxns = expenses.filter(t => COGS_IDS.has(t.category_id));
    const opexTxns = expenses.filter(t => !COGS_IDS.has(t.category_id));

    const cogs = cogsTxns.reduce((s, t) => s + (t.amount || 0), 0);
    const opex = opexTxns.reduce((s, t) => s + (t.amount || 0), 0);
    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - opex;
    const grossMargin = pct(grossProfit, revenue);
    const netMargin   = pct(netProfit, revenue);

    // Category breakdowns
    const buildCategoryMap = (list) => {
      const map = {};
      list.forEach(t => {
        const k = t.category_id || 'other';
        if (!map[k]) map[k] = { id: k, label: t.category_label || k, total: 0, count: 0 };
        map[k].total += t.amount || 0;
        map[k].count += 1;
      });
      return Object.values(map).sort((a, b) => b.total - a.total);
    };

    const cogsCategories   = buildCategoryMap(cogsTxns);
    const opexCategories   = buildCategoryMap(opexTxns);
    const incomeCategories = buildCategoryMap(incomes);

    // Top vendors (by total spend)
    const vendorMap = {};
    expenses.forEach(t => {
      const v = t.vendor?.trim();
      if (!v) return;
      if (!vendorMap[v]) vendorMap[v] = { name: v, total: 0, count: 0 };
      vendorMap[v].total += t.amount || 0;
      vendorMap[v].count += 1;
    });
    const topVendors = Object.values(vendorMap).sort((a, b) => b.total - a.total).slice(0, 6);

    // Monthly trend
    const monthMap = {};
    txns.forEach(t => {
      const d = parseTimestamp(t.created_at);
      if (!d) return;
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthMap[key]) monthMap[key] = { key, label, income: 0, expense: 0 };
      if (t.transaction_type === 'incoming') monthMap[key].income += t.amount || 0;
      else monthMap[key].expense += t.amount || 0;
    });
    const months = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));

    const avgExpense    = expenses.length ? totalExpense / expenses.length : 0;
    const largestExpense = expenses.reduce((m, t) => Math.max(m, t.amount || 0), 0);

    return {
      revenue, cogs, grossProfit, grossMargin,
      opex, netProfit, netMargin,
      cogsCategories, opexCategories, incomeCategories,
      topVendors, months,
      txCount: txns.length, expCount: expenses.length, incCount: incomes.length,
      avgExpense, largestExpense, totalExpense, budget,
    };
  }, [messages, currentProject]);

  const maxCogs   = cogsCategories[0]?.total || 1;
  const maxOpex   = opexCategories[0]?.total || 1;
  const maxIncome = incomeCategories[0]?.total || 1;
  const maxVendor = topVendors[0]?.total || 1;
  const maxMonth  = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

  const profitColor = netProfit >= 0 ? theme.colors.incoming : theme.colors.expense;
  const gpColor     = grossProfit >= 0 ? theme.colors.incoming : theme.colors.expense;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{currentProject?.client_name || '—'}</Text>
        </View>
        <IconButton icon="chart-bar" iconColor={theme.colors.accent} size={22} style={{ margin: 0 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── P&L Statement ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <SectionHeader title="Profit & Loss Statement" />
          <View style={styles.card}>
            {/* Revenue */}
            <PnlRow label="Revenue (Client Payments)" value={revenue} bold />

            {/* COGS */}
            <PnlRow label="Cost of Goods Sold (COGS)" value={-cogs} color={theme.colors.expense} borderTop />
            {cogsCategories.map((cat, i) => (
              <View key={cat.id} style={styles.subRow}>
                <View style={styles.subRowLeft}>
                  <View style={[styles.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                  <Text style={styles.subLabel}>{cat.label}</Text>
                </View>
                <Bar value={cat.total} max={maxCogs} color={PALETTE[i % PALETTE.length]} />
                <Text style={styles.subAmount}>{formatRupeesShort(cat.total)}</Text>
              </View>
            ))}
            {cogsCategories.length === 0 && (
              <Text style={styles.emptyNote}>No direct cost transactions yet</Text>
            )}

            {/* Gross Profit */}
            <View style={[styles.pnlRow, styles.pnlRowBorderTop, styles.highlightRow, {
              backgroundColor: grossProfit >= 0 ? theme.colors.incomingBg : theme.colors.expenseBg,
            }]}>
              <View>
                <Text style={styles.pnlLabelBold}>Gross Profit</Text>
                <Text style={[styles.pnlSubline, { color: gpColor }]}>Margin {grossMargin}%</Text>
              </View>
              <Text style={[styles.pnlValueBold, { color: gpColor }]}>{formatRupees(grossProfit)}</Text>
            </View>

            {/* OpEx */}
            {opex > 0 && (
              <>
                <PnlRow label="Operating Expenses" value={-opex} color={theme.colors.expense} borderTop />
                {opexCategories.map((cat, i) => (
                  <View key={cat.id} style={styles.subRow}>
                    <View style={styles.subRowLeft}>
                      <View style={[styles.dot, { backgroundColor: PALETTE[(i + 4) % PALETTE.length] }]} />
                      <Text style={styles.subLabel}>{cat.label}</Text>
                    </View>
                    <Bar value={cat.total} max={maxOpex} color={PALETTE[(i + 4) % PALETTE.length]} />
                    <Text style={styles.subAmount}>{formatRupeesShort(cat.total)}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Net Profit */}
            <View style={[styles.pnlRow, styles.pnlRowBorderTop, styles.highlightRow, {
              backgroundColor: netProfit >= 0 ? theme.colors.incomingBg : theme.colors.expenseBg,
            }]}>
              <View>
                <Text style={styles.pnlLabelBold}>Net Profit</Text>
                <Text style={[styles.pnlSubline, { color: profitColor }]}>Margin {netMargin}%</Text>
              </View>
              <Text style={[styles.pnlValueBold, { color: profitColor, fontSize: 18 }]}>{formatRupees(netProfit)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Key Ratios ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <SectionHeader title="Key Financial Ratios" />
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Gross Margin"
              value={`${grossMargin}%`}
              subtitle="GP / Revenue"
              color={gpColor}
            />
            <MetricCard
              label="Net Margin"
              value={`${netMargin}%`}
              subtitle="NP / Revenue"
              color={profitColor}
            />
            <MetricCard
              label="COGS Ratio"
              value={`${pct(cogs, revenue)}%`}
              subtitle="COGS / Revenue"
              color={theme.colors.expense}
            />
            <MetricCard
              label="OpEx Ratio"
              value={`${pct(opex, revenue)}%`}
              subtitle="OpEx / Revenue"
              color={theme.colors.accent}
            />
          </View>
        </Animated.View>

        {/* ── Budget Utilisation ─────────────────────────────────── */}
        {budget > 0 && (
          <Animated.View entering={FadeInDown.delay(140).duration(300)}>
            <SectionHeader title="Budget Utilisation" />
            <View style={styles.card}>
              <View style={styles.budgetHeaderRow}>
                <Text style={styles.budgetLabel}>Spent vs Budget</Text>
                <Text style={[styles.budgetPct, { color: totalExpense > budget ? theme.colors.expense : theme.colors.incoming }]}>
                  {pct(totalExpense, budget)}%
                </Text>
              </View>
              <View style={styles.budgetTrack}>
                <View style={[styles.budgetFill, {
                  width: `${Math.min(pct(totalExpense, budget), 100)}%`,
                  backgroundColor: totalExpense > budget ? theme.colors.expense : theme.colors.primary,
                }]} />
                {/* COGS portion overlay */}
                <View style={[styles.budgetFillOverlay, {
                  width: `${Math.min(pct(cogs, budget), 100)}%`,
                  backgroundColor: theme.colors.expense,
                  opacity: 0.6,
                }]} />
              </View>
              <View style={styles.budgetLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.expense, opacity: 0.6 }]} />
                  <Text style={styles.legendText}>COGS {formatRupeesShort(cogs)}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                  <Text style={styles.legendText}>Total Spend {formatRupeesShort(totalExpense)}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.secondary }]} />
                  <Text style={styles.legendText}>Budget {formatRupeesShort(budget)}</Text>
                </View>
              </View>
              {totalExpense > budget && (
                <View style={styles.overBudgetBanner}>
                  <IconButton icon="alert-circle-outline" iconColor={theme.colors.expense} size={16} style={{ margin: 0 }} />
                  <Text style={styles.overBudgetText}>
                    Over budget by {formatRupees(totalExpense - budget)}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Revenue Breakdown ──────────────────────────────────── */}
        {incomeCategories.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <SectionHeader title="Revenue Breakdown" />
            <View style={styles.card}>
              {incomeCategories.map((cat, i) => (
                <View key={cat.id} style={[styles.catRow, i < incomeCategories.length - 1 && styles.catRowBorder]}>
                  <View style={styles.catLeft}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.incoming }]} />
                    <View>
                      <Text style={styles.catLabel}>{cat.label}</Text>
                      <Text style={styles.catCount}>{cat.count} payment{cat.count !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.catRight}>
                    <Bar value={cat.total} max={maxIncome} color={theme.colors.incoming} />
                    <Text style={[styles.catAmount, { color: theme.colors.incoming }]}>{formatRupees(cat.total)}</Text>
                    <Text style={styles.catPct}>{pct(cat.total, revenue)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Top Vendors ────────────────────────────────────────── */}
        {topVendors.length > 0 && (
          <Animated.View entering={FadeInDown.delay(180).duration(300)}>
            <SectionHeader title="Top Vendors / Parties" />
            <View style={styles.card}>
              {topVendors.map((v, i) => (
                <View key={v.name} style={[styles.catRow, i < topVendors.length - 1 && styles.catRowBorder]}>
                  <View style={styles.catLeft}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{i + 1}</Text>
                    </View>
                    <View>
                      <Text style={styles.catLabel}>{v.name}</Text>
                      <Text style={styles.catCount}>{v.count} transaction{v.count !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.catRight}>
                    <Bar value={v.total} max={maxVendor} color={PALETTE[i % PALETTE.length]} />
                    <Text style={styles.catAmount}>{formatRupees(v.total)}</Text>
                    <Text style={styles.catPct}>{pct(v.total, totalExpense)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Monthly Trend ──────────────────────────────────────── */}
        {months.length > 1 && (
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <SectionHeader title="Monthly Trend" />
            <View style={styles.card}>
              {months.map((m, i) => (
                <View key={m.key} style={[styles.monthRow, i < months.length - 1 && styles.catRowBorder]}>
                  <Text style={styles.monthLabel}>{m.label}</Text>
                  <View style={styles.monthBars}>
                    <View style={styles.monthBarGroup}>
                      <Bar value={m.income} max={maxMonth} color={theme.colors.incoming} height={7} />
                      <Text style={[styles.monthAmt, { color: theme.colors.incoming }]}>+{formatRupeesShort(m.income)}</Text>
                    </View>
                    <View style={styles.monthBarGroup}>
                      <Bar value={m.expense} max={maxMonth} color={theme.colors.expense} height={7} />
                      <Text style={[styles.monthAmt, { color: theme.colors.expense }]}>-{formatRupeesShort(m.expense)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Transaction Summary ────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).duration(300)}>
          <SectionHeader title="Transaction Summary" />
          <View style={styles.metricsGrid}>
            <MetricCard label="Total Txns" value={String(txCount)} />
            <MetricCard label="Expenses" value={String(expCount)} color={theme.colors.expense} />
            <MetricCard label="Payments" value={String(incCount)} color={theme.colors.incoming} />
            <MetricCard
              label="Avg Expense"
              value={formatRupeesShort(avgExpense)}
              subtitle="per transaction"
            />
            <MetricCard
              label="Largest Expense"
              value={formatRupeesShort(largestExpense)}
              color={theme.colors.expense}
            />
            <MetricCard
              label="Break Even"
              value={revenue > 0 ? (netProfit >= 0 ? 'Yes ✓' : 'No ✗') : '—'}
              color={netProfit >= 0 ? theme.colors.incoming : theme.colors.expense}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.onSurface },
  headerSub:   { fontSize: 12, color: theme.colors.secondary, marginTop: 1 },

  scroll: { padding: 16 },

  // Section header
  sectionHeader: { marginTop: 20, marginBottom: 10 },
  sectionTitle:  {
    fontSize: 11, fontWeight: '700', color: theme.colors.onSurfaceVariant,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },

  // Card
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.outline,
    overflow: 'hidden',
  },

  // P&L rows
  pnlRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  pnlRowBorderTop: { borderTopWidth: 1, borderTopColor: theme.colors.outline },
  pnlLabel:     { fontSize: 14, color: theme.colors.onSurfaceVariant, flex: 1 },
  pnlLabelBold: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, flex: 1 },
  pnlValue:     { fontSize: 14, color: theme.colors.onSurface },
  pnlValueBold: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  pnlSubline:   { fontSize: 11, fontWeight: '600', marginTop: 2 },
  highlightRow: { paddingHorizontal: 16, paddingVertical: 14 },

  // Sub-rows (category inside COGS / OpEx)
  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: theme.colors.surface,
  },
  subRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, width: 120 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subLabel:  { fontSize: 12, color: theme.colors.secondary, flex: 1 },
  subAmount: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface, width: 56, textAlign: 'right' },
  emptyNote: { fontSize: 12, color: theme.colors.secondary, paddingHorizontal: 16, paddingVertical: 10 },

  // Bar
  barTrack: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill:  {},

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    flex: 1, minWidth: '28%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1, borderColor: theme.colors.outline,
    padding: 14, alignItems: 'center',
  },
  metricValue:    { fontSize: 18, fontWeight: '700', color: theme.colors.onSurface },
  metricLabel:    { fontSize: 10, color: theme.colors.secondary, marginTop: 4, textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricSubtitle: { fontSize: 10, color: theme.colors.secondary, marginTop: 2, textAlign: 'center' },

  // Budget
  budgetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  budgetLabel: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' },
  budgetPct:   { fontSize: 15, fontWeight: '700' },
  budgetTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5, marginHorizontal: 16, position: 'relative', overflow: 'hidden' },
  budgetFill:  { height: 10, borderRadius: 5, position: 'absolute', left: 0, top: 0 },
  budgetFillOverlay: { height: 10, borderRadius: 5, position: 'absolute', left: 0, top: 0 },
  budgetLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: theme.colors.secondary },
  overBudgetBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.expenseBg,
    paddingHorizontal: 14, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: theme.colors.outline,
  },
  overBudgetText: { fontSize: 12, color: theme.colors.expense, fontWeight: '600' },

  // Category rows
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  catLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, width: 130 },
  catRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '500' },
  catCount: { fontSize: 10, color: theme.colors.secondary, marginTop: 1 },
  catAmount:{ fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, width: 64, textAlign: 'right' },
  catPct:   { fontSize: 10, color: theme.colors.secondary, width: 28, textAlign: 'right' },

  // Rank badge
  rankBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.outline,
  },
  rankText: { fontSize: 10, fontWeight: '700', color: theme.colors.secondary },

  // Monthly trend
  monthRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  monthLabel:   { width: 48, fontSize: 11, fontWeight: '600', color: theme.colors.secondary },
  monthBars:    { flex: 1, gap: 5 },
  monthBarGroup:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthAmt:     { fontSize: 11, fontWeight: '600', width: 60, textAlign: 'right' },
});
