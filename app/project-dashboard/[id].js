import { useCallback, useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, IconButton, Modal, Portal, TextInput } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, formatRupees, CATEGORIES } from '../../src/constants/theme';
import { formatTime } from '../../src/utils/datetime';
import { useAppStore } from '../../src/stores/appStore';
import { impactLight, impactMedium } from '../../src/utils/haptics';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProjectDashboardScreen() {
  const { id } = useLocalSearchParams();
  const projectId = parseInt(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    currentProject,
    messages,
    loadProject,
    updateProject,
    deleteProject,
    updateTransaction,
    deleteTransaction,
  } = useAppStore();

  // ── Project edit state ──────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Transaction filter + edit state ────────────────────────────────
  const [filterType, setFilterType] = useState('all'); // 'all' | 'incoming' | 'expense'
  const [editTxn, setEditTxn] = useState(null);
  const [txnAmount, setTxnAmount] = useState('');
  const [txnVendor, setTxnVendor] = useState('');
  const [txnCategory, setTxnCategory] = useState('');
  const [isSavingTxn, setIsSavingTxn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadError(null);
      Promise.resolve(loadProject(projectId)).catch((e) => {
        if (!active) return;
        console.error('Failed to load project:', e);
        setLoadError(e?.message || 'Could not load this project.');
      });
      return () => { active = false; };
    }, [projectId])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await loadProject(projectId); } catch (e) { console.error(e); }
    finally { setIsRefreshing(false); }
  }, [projectId]);

  const openChat = () => {
    impactMedium();
    router.push(`/project/${projectId}`);
  };

  const openEditProject = () => {
    impactLight();
    setEditClientName(currentProject?.client_name || '');
    setEditProjectName(currentProject?.project_name || '');
    setEditBudget(String(currentProject?.budget || ''));
    setShowEdit(true);
  };

  const handleSaveProject = async () => {
    if (!editClientName.trim() || !editProjectName.trim()) return;
    setIsSaving(true);
    try {
      await updateProject(projectId, {
        client_name: editClientName.trim(),
        project_name: editProjectName.trim(),
        budget: parseFloat(editBudget) || 0,
      });
      setShowEdit(false);
    } catch (e) {
      console.error('Failed to update project:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = () => {
    impactLight();
    Alert.alert(
      'Delete project?',
      `This will permanently delete "${currentProject?.client_name || 'this project'}" and all its transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProject(projectId);
              router.replace('/');
            } catch (e) {
              console.error('Failed to delete project:', e);
            }
          },
        },
      ]
    );
  };

  // ── Transaction edit ────────────────────────────────────────────────
  const openEditTxn = (item) => {
    impactLight();
    setEditTxn(item);
    setTxnAmount(item.amount != null ? String(item.amount) : '');
    setTxnVendor(item.vendor || '');
    setTxnCategory(item.category_id || '');
  };

  const handleSaveTxn = async () => {
    if (!editTxn?.transaction_id) return;
    const amt = parseFloat(txnAmount);
    if (!amt || isNaN(amt) || amt <= 0) return;
    setIsSavingTxn(true);
    try {
      const cat = CATEGORIES[editTxn.transaction_type]?.find((c) => c.id === txnCategory);
      await updateTransaction(editTxn.transaction_id, projectId, {
        amount: amt,
        vendor: txnVendor.trim(),
        category_id: txnCategory,
        category_label: cat?.label || txnCategory,
      });
      setEditTxn(null);
    } catch (e) {
      console.error('Failed to update transaction:', e);
    } finally {
      setIsSavingTxn(false);
    }
  };

  const handleDeleteTxn = (item) => {
    impactLight();
    Alert.alert(
      'Delete transaction?',
      `${item.transaction_type === 'incoming' ? '+' : '-'}${formatRupees(item.amount || 0)} — ${item.content || 'Transaction'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(item.transaction_id, projectId);
            } catch (e) {
              console.error('Failed to delete transaction:', e);
            }
          },
        },
      ]
    );
  };

  // ── Derived data ────────────────────────────────────────────────────
  const transactions = useMemo(
    () =>
      (messages || [])
        .filter((m) => m.transaction_id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [messages]
  );

  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return transactions;
    return transactions.filter((t) => t.transaction_type === filterType);
  }, [transactions, filterType]);

  const incomeCount   = useMemo(() => transactions.filter((t) => t.transaction_type === 'incoming').length, [transactions]);
  const expenseCount  = useMemo(() => transactions.filter((t) => t.transaction_type === 'expense').length, [transactions]);

  const totalIncoming = currentProject?.total_incoming || 0;
  const totalExpense = currentProject?.total_expense || 0;
  const balance = totalIncoming - totalExpense;
  const budget = currentProject?.budget || 0;
  const budgetPercent = budget > 0 ? Math.min((totalExpense / budget) * 100, 100) : 0;

  // ── Render helpers ──────────────────────────────────────────────────
  const renderTransaction = ({ item }) => {
    const isIncoming = item.transaction_type === 'incoming';
    const color    = isIncoming ? theme.colors.incoming : theme.colors.expense;
    const bgColor  = isIncoming ? theme.colors.incomingBg : theme.colors.expenseBg;
    const catList  = CATEGORIES[item.transaction_type] || [];
    const catDef   = catList.find((c) => c.id === item.category_id);
    const icon     = catDef?.icon || (isIncoming ? 'arrow-down-circle' : 'arrow-up-circle');
    const catLabel = item.category_label || catDef?.label || (isIncoming ? 'Payment' : 'Expense');

    return (
      <Pressable
        style={styles.txnCard}
        onPress={() => openEditTxn(item)}
        android_ripple={{ color: 'rgba(255,255,255,0.04)', borderless: false }}
      >
        {/* Category icon */}
        <View style={[styles.txnIcon, { backgroundColor: bgColor }]}>
          <IconButton icon={icon} iconColor={color} size={20} style={{ margin: 0 }} />
        </View>

        {/* Label + vendor */}
        <View style={styles.txnContent}>
          <Text style={styles.txnTitle} numberOfLines={1}>{catLabel}</Text>
          <Text style={styles.txnSub} numberOfLines={1}>
            {item.vendor ? item.vendor + '  ·  ' : ''}{formatTime(item.created_at)}
          </Text>
        </View>

        {/* Amount + actions */}
        <View style={styles.txnRight}>
          <Text style={[styles.txnAmount, { color }]}>
            {isIncoming ? '+' : '-'}{formatRupees(item.amount || 0)}
          </Text>
          <View style={styles.txnActions}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); openEditTxn(item); }}
              hitSlop={10}
            >
              <IconButton icon="pencil-outline" iconColor={theme.colors.secondary} size={14} style={{ margin: 0 }} />
            </Pressable>
            <Pressable
              onPress={(e) => { e.stopPropagation(); handleDeleteTxn(item); }}
              hitSlop={10}
            >
              <IconButton icon="trash-can-outline" iconColor={theme.colors.expense} size={14} style={{ margin: 0 }} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  // ── Error screen ────────────────────────────────────────────────────
  if (loadError && !currentProject) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 28, paddingTop: insets.top + 40 }]}>
        <IconButton icon="alert-circle-outline" iconColor={theme.colors.expense} size={44} style={{ margin: 0 }} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, marginTop: 12, marginBottom: 6 }}>
          Couldn't open this project
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.secondary, textAlign: 'center', lineHeight: 20, marginBottom: 22 }}>
          {loadError}
        </Text>
        <Pressable
          style={{ backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, marginBottom: 12 }}
          onPress={() => {
            setLoadError(null);
            Promise.resolve(loadProject(projectId)).catch((e) =>
              setLoadError(e?.message || 'Could not load this project.')
            );
          }}
        >
          <Text style={{ color: '#0A0A0A', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
        </Pressable>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={{ color: theme.colors.secondary, fontSize: 14, fontWeight: '600' }}>Back to projects</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <Text style={styles.headerTitle}>Project</Text>
        <Pressable style={styles.headerBtn} onPress={() => { impactLight(); router.push(`/project-analytics/${projectId}`); }}>
          <IconButton icon="chart-bar" iconColor={theme.colors.accent} size={20} style={{ margin: 0 }} />
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={openEditProject}>
          <IconButton icon="pencil-outline" iconColor={theme.colors.primary} size={20} style={{ margin: 0 }} />
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={handleDeleteProject}>
          <IconButton icon="trash-can-outline" iconColor={theme.colors.expense} size={20} style={{ margin: 0 }} />
        </Pressable>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTransaction}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Project Card */}
            <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <View style={styles.projectAvatar}>
                  <Text style={styles.projectAvatarText}>{getInitials(currentProject?.client_name)}</Text>
                </View>
                <View style={styles.projectInfo}>
                  <Text style={styles.projectClientName} numberOfLines={1}>
                    {currentProject?.client_name || 'Loading…'}
                  </Text>
                  <Text style={styles.projectProjectName} numberOfLines={1}>
                    {currentProject?.project_name || ''}
                  </Text>
                </View>
                <View style={[styles.balanceBadge, { backgroundColor: balance >= 0 ? theme.colors.incomingMuted : theme.colors.expenseMuted }]}>
                  <Text style={[styles.balanceBadgeText, { color: balance >= 0 ? theme.colors.incoming : theme.colors.expense }]}>
                    {balance >= 0 ? '+' : '-'}{formatRupees(Math.abs(balance))}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: theme.colors.incoming }]}>{formatRupees(totalIncoming)}</Text>
                  <Text style={styles.statLabel}>Income</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: theme.colors.expense }]}>{formatRupees(totalExpense)}</Text>
                  <Text style={styles.statLabel}>Expense</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{formatRupees(budget)}</Text>
                  <Text style={styles.statLabel}>Budget</Text>
                </View>
              </View>

              {budget > 0 && (
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Budget used</Text>
                  <View style={styles.budgetBarContainer}>
                    <View style={[styles.budgetBar, { width: `${budgetPercent}%`, backgroundColor: totalExpense > budget ? theme.colors.expense : theme.colors.primary }]} />
                  </View>
                  <Text style={[styles.budgetPercent, { color: totalExpense > budget ? theme.colors.expense : theme.colors.onSurfaceVariant }]}>
                    {Math.round((totalExpense / budget) * 100)}%
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Transactions section header + filter tabs */}
            {transactions.length > 0 && (
              <Animated.View entering={FadeIn.delay(100).duration(300)}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Transactions</Text>
                  <Text style={styles.sectionCount}>{filteredTransactions.length}</Text>
                </View>
                <View style={styles.filterRow}>
                  {[
                    { key: 'all',      label: 'All',     count: transactions.length },
                    { key: 'incoming', label: 'Income',  count: incomeCount },
                    { key: 'expense',  label: 'Expense', count: expenseCount },
                  ].map((tab) => (
                    <Pressable
                      key={tab.key}
                      style={[styles.filterTab, filterType === tab.key && styles.filterTabActive]}
                      onPress={() => { impactLight(); setFilterType(tab.key); }}
                    >
                      <Text style={[styles.filterTabText, filterType === tab.key && styles.filterTabTextActive]}>
                        {tab.label}
                      </Text>
                      <Text style={[styles.filterTabCount, filterType === tab.key && styles.filterTabCountActive]}>
                        {tab.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.emptyState}>
            <IconButton icon="receipt-text-outline" iconColor={theme.colors.secondary} size={40} style={{ margin: 0 }} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>Open chat to record income, expenses, or share receipts.</Text>
          </Animated.View>
        }
      />

      {/* FAB — Open Chat */}
      <Animated.View
        entering={FadeIn.delay(200).duration(300)}
        style={[styles.fab, { bottom: Math.max(24, insets.bottom + 16) }]}
      >
        <Pressable style={styles.fabButton} onPress={openChat} android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}>
          <IconButton icon="chat-processing-outline" iconColor="#080808" size={26} style={{ margin: 0 }} />
        </Pressable>
      </Animated.View>

      {/* Edit Project Modal */}
      <Portal>
        <Modal visible={showEdit} onDismiss={() => setShowEdit(false)} contentContainerStyle={[styles.modal, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Project</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Client Name</Text>
            <TextInput
              value={editClientName}
              onChangeText={setEditClientName}
              mode="outlined"
              style={styles.input}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              theme={{ roundness: 12 }}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Project Name</Text>
            <TextInput
              value={editProjectName}
              onChangeText={setEditProjectName}
              mode="outlined"
              style={styles.input}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              theme={{ roundness: 12 }}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Budget</Text>
            <TextInput
              value={editBudget}
              onChangeText={setEditBudget}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              theme={{ roundness: 12 }}
            />
          </View>
          <Pressable
            style={[styles.saveButton, (!editClientName.trim() || !editProjectName.trim() || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSaveProject}
            disabled={!editClientName.trim() || !editProjectName.trim() || isSaving}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setShowEdit(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Modal>
      </Portal>

      {/* Edit Transaction Modal */}
      <Portal>
        <Modal
          visible={!!editTxn}
          onDismiss={() => setEditTxn(null)}
          contentContainerStyle={[styles.modal, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Transaction</Text>
          {editTxn && (
            <Text style={styles.txnEditDesc} numberOfLines={2}>{editTxn.content}</Text>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput
              value={txnAmount}
              onChangeText={setTxnAmount}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              theme={{ roundness: 12 }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vendor / Party</Text>
            <TextInput
              value={txnVendor}
              onChangeText={setTxnVendor}
              mode="outlined"
              style={styles.input}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              theme={{ roundness: 12 }}
              placeholder="Optional"
              placeholderTextColor={theme.colors.secondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {(CATEGORIES[editTxn?.transaction_type] || []).map((cat) => {
                const active = txnCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setTxnCategory(cat.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Pressable
            style={[styles.saveButton, (isSavingTxn || !txnAmount) && styles.saveButtonDisabled]}
            onPress={handleSaveTxn}
            disabled={isSavingTxn || !txnAmount}
          >
            <Text style={styles.saveButtonText}>{isSavingTxn ? 'Saving…' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setEditTxn(null)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerBtn: {
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
  listContent: {
    padding: 16,
  },

  // ── Project card ──────────────────────────────────────────────────
  projectCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  projectAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  projectAvatarText: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  projectInfo: {
    flex: 1,
  },
  projectClientName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
  },
  projectProjectName: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  balanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  balanceBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.colors.onSurface,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  budgetLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
    width: 74,
  },
  budgetBarContainer: {
    flex: 1,
    height: 5,
    backgroundColor: theme.colors.surface,
    borderRadius: 3,
  },
  budgetBar: {
    height: 5,
    borderRadius: 3,
  },
  budgetPercent: {
    fontSize: 11,
    fontWeight: '600',
    width: 34,
    textAlign: 'right',
  },

  // ── Section header + filter tabs ─────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.secondary,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.outlineVariant,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.secondary,
  },
  filterTabTextActive: {
    color: theme.colors.primary,
  },
  filterTabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.secondary,
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterTabCountActive: {
    color: theme.colors.primary,
    backgroundColor: 'rgba(232,232,232,0.12)',
  },

  // ── Transaction card ──────────────────────────────────────────────
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 8,
    padding: 12,
    paddingRight: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  txnIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  txnContent: {
    flex: 1,
    gap: 3,
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.1,
  },
  txnSub: {
    fontSize: 12,
    color: theme.colors.secondary,
    fontWeight: '400',
  },
  txnRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  txnActions: {
    flexDirection: 'row',
    marginTop: 2,
  },

  // ── FAB ───────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Empty state ───────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.secondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 40,
  },

  // ── Modals ────────────────────────────────────────────────────────
  modal: {
    backgroundColor: theme.colors.surfaceElevated,
    margin: 20,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.outline,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 6,
  },
  txnEditDesc: {
    fontSize: 13,
    color: theme.colors.secondary,
    marginBottom: 18,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.surface,
    fontSize: 14,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.secondary,
  },
  chipTextActive: {
    color: theme.colors.primary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080808',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.secondary,
  },
});
