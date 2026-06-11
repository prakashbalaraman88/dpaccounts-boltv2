import { useCallback } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { theme, formatRupees, ALL_CATEGORIES } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';

function ProjectPnlCard({ project, index }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const router = useRouter();
  const pnl = project.total_incoming - project.total_expense;
  const getInitials = (name) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 80).springify().damping(18)}
      style={animStyle}
    >
      <Pressable
        style={styles.pnlCard}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 200 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
        onPress={() => router.push(`/project/${project.id}`)}
      >
        <View style={styles.pnlCardHeader}>
          <View style={styles.pnlAvatar}>
            <Text style={styles.pnlAvatarText}>{getInitials(project.client_name)}</Text>
          </View>
          <View style={styles.pnlCardInfo}>
            <Text style={styles.pnlClientName} numberOfLines={1}>{project.client_name}</Text>
            <Text style={styles.pnlProjectName} numberOfLines={1}>{project.project_name}</Text>
          </View>
          <View style={[styles.pnlBadge, { backgroundColor: pnl >= 0 ? theme.colors.incomingMuted : theme.colors.expenseMuted }]}>
            <Text style={[styles.pnlBadgeText, { color: pnl >= 0 ? theme.colors.incoming : theme.colors.expense }]}>
              {pnl >= 0 ? '+' : '-'}{formatRupees(Math.abs(pnl))}
            </Text>
          </View>
        </View>

        <View style={styles.pnlCardStats}>
          <View style={styles.pnlStat}>
            <View style={[styles.pnlStatDot, { backgroundColor: theme.colors.incoming }]} />
            <Text style={styles.pnlStatLabel}>Income</Text>
            <Text style={[styles.pnlStatValue, { color: theme.colors.incoming }]}>{formatRupees(project.total_incoming)}</Text>
          </View>
          <View style={styles.pnlStatDivider} />
          <View style={styles.pnlStat}>
            <View style={[styles.pnlStatDot, { backgroundColor: theme.colors.expense }]} />
            <Text style={styles.pnlStatLabel}>Expense</Text>
            <Text style={[styles.pnlStatValue, { color: theme.colors.expense }]}>{formatRupees(project.total_expense)}</Text>
          </View>
        </View>

        {project.budget > 0 && (
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Budget</Text>
            <Text style={styles.budgetValue}>{formatRupees(project.budget)}</Text>
            <View style={styles.budgetBarContainer}>
              <View
                style={[
                  styles.budgetBar,
                  {
                    width: `${Math.min((project.total_expense / project.budget) * 100, 100)}%`,
                    backgroundColor: project.total_expense > project.budget ? theme.colors.expense : theme.colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.budgetPercent, { color: project.total_expense > project.budget ? theme.colors.expense : theme.colors.onSurfaceVariant }]}>
              {Math.round((project.total_expense / project.budget) * 100)}%
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function CategoryBreakdownItem({ item, maxTotal }) {
  const catDef = ALL_CATEGORIES.find((c) => c.id === item.category_id);
  const barWidth = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
  const isIncoming = item.type === 'incoming';

  return (
    <View style={styles.catItem}>
      <View style={styles.catIconWrap}>
        <IconButton
          icon={catDef?.icon || 'help-circle-outline'}
          iconColor={isIncoming ? theme.colors.incoming : theme.colors.expense}
          size={18}
          style={{ margin: 0 }}
        />
      </View>
      <View style={styles.catInfo}>
        <View style={styles.catTopRow}>
          <Text style={styles.catLabel} numberOfLines={1}>{item.category_label}</Text>
          <Text style={[styles.catAmount, { color: isIncoming ? theme.colors.incoming : theme.colors.expense }]}>
            {formatRupees(item.total)}
          </Text>
        </View>
        <View style={styles.catBarContainer}>
          <View
            style={[
              styles.catBar,
              {
                width: `${barWidth}%`,
                backgroundColor: isIncoming ? theme.colors.incoming : theme.colors.expense,
              },
            ]}
          />
        </View>
        <Text style={styles.catCount}>{item.count} transaction{item.count !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { projects, loadProjects, overallCategoryBreakdown, loadOverallCategoryBreakdown } = useAppStore();

  useFocusEffect(
    useCallback(() => {
      loadProjects();
      loadOverallCategoryBreakdown();
    }, [])
  );

  const totalIncoming = projects.reduce((sum, p) => sum + p.total_incoming, 0);
  const totalExpense = projects.reduce((sum, p) => sum + p.total_expense, 0);
  const netPnl = totalIncoming - totalExpense;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const projectCount = projects.length;
  const activeProjects = projects.filter((p) => p.total_incoming > 0 || p.total_expense > 0).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Pressable style={styles.settingsLink} onPress={() => router.push('/settings')}>
          <IconButton icon="cog-outline" iconColor={theme.colors.onSurfaceVariant} size={20} style={{ margin: 0 }} />
        </Pressable>
      </Animated.View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => <ProjectPnlCard project={item} index={index} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Overall P&L Card */}
            <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={styles.overallCard}>
              <Text style={styles.overallLabel}>NET PROFIT / LOSS</Text>
              <Text style={[styles.overallAmount, { color: netPnl >= 0 ? theme.colors.incoming : theme.colors.expense }]}>
                {netPnl >= 0 ? '+' : '-'}{formatRupees(Math.abs(netPnl))}
              </Text>

              <View style={styles.overallSplit}>
                <View style={styles.overallSplitItem}>
                  <View style={[styles.overallDot, { backgroundColor: theme.colors.incoming }]} />
                  <View>
                    <Text style={styles.overallSplitLabel}>Total Income</Text>
                    <Text style={[styles.overallSplitAmount, { color: theme.colors.incoming }]}>
                      {formatRupees(totalIncoming)}
                    </Text>
                  </View>
                </View>
                <View style={styles.overallSplitDivider} />
                <View style={styles.overallSplitItem}>
                  <View style={[styles.overallDot, { backgroundColor: theme.colors.expense }]} />
                  <View>
                    <Text style={styles.overallSplitLabel}>Total Expense</Text>
                    <Text style={[styles.overallSplitAmount, { color: theme.colors.expense }]}>
                      {formatRupees(totalExpense)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Quick Stats Row */}
            <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{projectCount}</Text>
                <Text style={styles.statBoxLabel}>Projects</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{activeProjects}</Text>
                <Text style={styles.statBoxLabel}>Active</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{formatRupees(totalBudget)}</Text>
                <Text style={styles.statBoxLabel}>Total Budget</Text>
              </View>
            </Animated.View>

            {/* Category Breakdown */}
            {overallCategoryBreakdown.length > 0 && (() => {
              const expenseItems = overallCategoryBreakdown.filter((c) => c.type === 'expense');
              const incomingItems = overallCategoryBreakdown.filter((c) => c.type === 'incoming');
              const maxExpense = expenseItems.length > 0 ? Math.max(...expenseItems.map((c) => c.total)) : 0;
              const maxIncoming = incomingItems.length > 0 ? Math.max(...incomingItems.map((c) => c.total)) : 0;

              return (
                <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} style={styles.catSection}>
                  <Text style={styles.catSectionTitle}>EXPENSE BREAKDOWN</Text>
                  {expenseItems.length > 0 ? (
                    expenseItems.map((item) => (
                      <CategoryBreakdownItem key={item.category_id} item={item} maxTotal={maxExpense} />
                    ))
                  ) : (
                    <Text style={styles.catEmpty}>No expenses recorded</Text>
                  )}

                  {incomingItems.length > 0 && (
                    <>
                      <Text style={[styles.catSectionTitle, { marginTop: 18 }]}>INCOME BREAKDOWN</Text>
                      {incomingItems.map((item) => (
                        <CategoryBreakdownItem key={item.category_id} item={item} maxTotal={maxIncoming} />
                      ))}
                    </>
                  )}
                </Animated.View>
              );
            })()}

            {/* Section Header */}
            {projects.length > 0 && (
              <Animated.View entering={FadeIn.delay(200)} style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Project-wise P&L</Text>
              </Animated.View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
            <IconButton icon="chart-box-outline" iconColor={theme.colors.secondary} size={40} style={{ margin: 0 }} />
            <Text style={styles.emptyText}>No projects to analyze yet</Text>
          </Animated.View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  settingsLink: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Overall P&L Card
  overallCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  overallLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  overallAmount: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 22,
  },
  overallSplit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overallSplitItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overallSplitLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  overallSplitAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  overallSplitDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.outline,
    marginHorizontal: 12,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  statBoxLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Project P&L Card
  pnlCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  pnlCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  pnlAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pnlAvatarText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  pnlCardInfo: {
    flex: 1,
  },
  pnlClientName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  pnlProjectName: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
    marginTop: 1,
  },
  pnlBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pnlBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pnlCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  pnlStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pnlStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pnlStatLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  pnlStatValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pnlStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.outline,
    marginHorizontal: 8,
  },

  // Budget Row
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  budgetLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  budgetValue: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '600',
  },
  budgetBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: 2,
  },
  budgetBar: {
    height: 4,
    borderRadius: 2,
  },
  budgetPercent: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Category Breakdown
  catSection: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  catSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.secondary,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  catIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  catInfo: {
    flex: 1,
  },
  catTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurface,
    flex: 1,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  catBarContainer: {
    height: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: 2,
    marginBottom: 4,
  },
  catBar: {
    height: 4,
    borderRadius: 2,
  },
  catCount: {
    fontSize: 10,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  catEmpty: {
    fontSize: 12,
    color: theme.colors.secondary,
    fontStyle: 'italic',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.secondary,
    marginTop: 12,
  },
});
