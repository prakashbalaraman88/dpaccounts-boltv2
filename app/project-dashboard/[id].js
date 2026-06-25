import { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { Text, IconButton, Modal, Portal, TextInput } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, formatRupees, CATEGORIES } from '../../src/constants/theme';
import { formatTime } from '../../src/utils/datetime';
import { useAppStore } from '../../src/stores/appStore';
import { impactLight, impactMedium } from '../../src/utils/haptics';

const { width } = Dimensions.get('window');

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getCategoryLabel(id, type) {
  const cat = CATEGORIES[type]?.find((c) => c.id === id);
  return cat?.label || id;
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
  } = useAppStore();

  const [showEdit, setShowEdit] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Surfaces a load failure as a friendly screen instead of letting an
  // unhandled rejection from loadProject bubble up to the crash guard.
  const [loadError, setLoadError] = useState(null);

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

  const openChat = () => {
    impactMedium();
    router.push(`/project/${projectId}`);
  };

  const openEdit = () => {
    impactLight();
    setEditClientName(currentProject?.client_name || '');
    setEditProjectName(currentProject?.project_name || '');
    setEditBudget(String(currentProject?.budget || ''));
    setShowEdit(true);
  };

  const handleSave = async () => {
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

  const handleDelete = () => {
    impactLight();
    Alert.alert(
      'Delete project?',
      `This will permanently delete ${currentProject?.client_name || 'this project'} and all its messages/transactions.`,
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

  const transactions = (messages || [])
    .filter((m) => m.transaction_id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalIncoming = currentProject?.total_incoming || 0;
  const totalExpense = currentProject?.total_expense || 0;
  const balance = totalIncoming - totalExpense;
  const budget = currentProject?.budget || 0;
  const budgetPercent = budget > 0 ? Math.min((totalExpense / budget) * 100, 100) : 0;

  const renderTransaction = ({ item }) => {
    const isIncoming = item.transaction_type === 'incoming';
    return (
      <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={styles.txnCard}>
        <View style={styles.txnRow}>
          <View style={[styles.txnDot, { backgroundColor: isIncoming ? theme.colors.incoming : theme.colors.expense }]} />
          <View style={styles.txnInfo}>
            <Text style={styles.txnDescription} numberOfLines={1}>{item.content || 'Transaction'}</Text>
            <Text style={styles.txnMeta}>
              {getCategoryLabel(item.category_id, item.transaction_type)} · {formatTime(item.created_at)}
            </Text>
          </View>
          <Text style={[styles.txnAmount, { color: isIncoming ? theme.colors.incoming : theme.colors.expense }]}>
            {isIncoming ? '+' : '-'}{formatRupees(item.amount || 0)}
          </Text>
        </View>
        {item.vendor ? <Text style={styles.txnVendor}>Vendor: {item.vendor}</Text> : null}
      </Animated.View>
    );
  };

  // Render a recoverable error screen if loadProject fails
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <Text style={styles.headerTitle}>Project</Text>
        <Pressable style={styles.headerBtn} onPress={openEdit}>
          <IconButton icon="pencil-outline" iconColor={theme.colors.primary} size={20} style={{ margin: 0 }} />
        </Pressable>
      </Animated.View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Project Card */}
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.projectCard}>
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

            {/* Actions */}
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={styles.actionsRow}>
              <Pressable style={styles.chatButton} onPress={openChat}>
                <IconButton icon="chat-processing-outline" iconColor="#080808" size={20} style={{ margin: 0 }} />
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <IconButton icon="trash-can-outline" iconColor={theme.colors.expense} size={20} style={{ margin: 0 }} />
              </Pressable>
            </Animated.View>

            {/* Transactions header */}
            {transactions.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Transactions ({transactions.length})</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
            <IconButton icon="receipt-text-outline" iconColor={theme.colors.secondary} size={40} style={{ margin: 0 }} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>Open chat to record income, expenses, or share receipts.</Text>
          </Animated.View>
        }
      />

      {/* Edit Modal */}
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
            onPress={handleSave}
            disabled={!editClientName.trim() || !editProjectName.trim() || isSaving}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setShowEdit(false)}>
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
    paddingBottom: 32,
  },
  projectCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080808',
  },
  deleteButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.colors.expenseMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.15)',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  txnCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  txnInfo: {
    flex: 1,
  },
  txnDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  txnMeta: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txnVendor: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 6,
    fontWeight: '500',
  },
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
    marginBottom: 18,
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
