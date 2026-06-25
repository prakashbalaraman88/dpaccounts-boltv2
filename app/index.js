import { useCallback, useState, useMemo, useEffect } from 'react';
import { View, FlatList, StyleSheet, Pressable, ScrollView, Platform, Keyboard, Dimensions } from 'react-native';
import { Text, Portal, Modal, TextInput, IconButton } from 'react-native-paper';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeInUp,
  FadeInRight,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, formatRupees } from '../src/constants/theme';
import { formatRelativeDay } from '../src/utils/datetime';
import { useAppStore } from '../src/stores/appStore';
import { useAuthStore } from '../src/stores/authStore';
import { impactLight, impactMedium, notificationSuccess } from '../src/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---- Logo Component ----
function LedgeLogo({ size = 36 }) {
  return (
    <View style={[logoStyles.container, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[logoStyles.letter, { fontSize: size * 0.48 }]}>L</Text>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  container: {
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    color: '#080808',
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: -1,
  },
});

// ---- Animated Project Card ----
function ProjectCard({ item, index, onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const balance = item.total_incoming - item.total_expense;

  const getInitials = (name) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getTimeString = (dateStr) => formatRelativeDay(dateStr);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 60, 300)).springify().damping(20).stiffness(120)}
      style={animatedStyle}
    >
      <Pressable
        style={styles.projectCard}
        onPressIn={() => { scale.value = withSpring(0.975, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
        onPress={() => onPress(item.id)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.client_name)}</Text>
        </View>
        <View style={styles.projectInfo}>
          <View style={styles.projectHeader}>
            <Text style={styles.clientName} numberOfLines={1}>{item.client_name}</Text>
            <Text style={styles.timeText}>{getTimeString(item.last_message_time)}</Text>
          </View>
          <Text style={styles.projectTitle} numberOfLines={1}>{item.project_name}</Text>
          <View style={styles.projectFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message || 'No messages yet'}
            </Text>
            <View
              style={[
                styles.balanceBadge,
                { backgroundColor: balance >= 0 ? theme.colors.incomingMuted : theme.colors.expenseMuted },
              ]}
            >
              <Text
                style={[styles.balanceTextSmall, { color: balance >= 0 ? theme.colors.incoming : theme.colors.expense }]}
              >
                {formatRupees(Math.abs(balance))}
              </Text>
            </View>
          </View>
        </View>
        <IconButton icon="chevron-right" iconColor={theme.colors.secondary} size={18} style={{ margin: 0, marginLeft: 4 }} />
      </Pressable>
    </Animated.View>
  );
}

// ---- Quick Action Card ----
function QuickAction({ icon, label, sublabel, onPress, delay = 0, color }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    impactLight();
    onPress?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(18).stiffness(120)}
      style={[animStyle, { flex: 1 }]}
    >
      <Pressable
        style={styles.quickActionCard}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 12, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
        onPress={handlePress}
      >
        <View style={[styles.quickActionIcon, color && { backgroundColor: color }]}>
          <IconButton icon={icon} iconColor="#F0F0F0" size={20} style={{ margin: 0 }} />
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
        <View style={styles.quickActionFooter}>
          <Text style={styles.quickActionSublabel}>{sublabel}</Text>
          <IconButton icon="chevron-right" iconColor={theme.colors.secondary} size={14} style={{ margin: 0 }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---- Bottom Nav Button ----
function NavButton({ icon, label, onPress, isActive = false }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    if (!isActive) impactLight();
    onPress?.();
  };
  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.navButton}
        onPressIn={() => { scale.value = withSpring(0.88, { damping: 12, stiffness: 250 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 250 }); }}
        onPress={handlePress}
      >
        <IconButton
          icon={icon}
          iconColor={isActive ? theme.colors.primary : theme.colors.secondary}
          size={22}
          style={{ margin: 0 }}
        />
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// =============== MAIN SCREEN ===============

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projects, loadProjects, createProject } = useAppStore();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showRecentClients, setShowRecentClients] = useState(false);
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [budget, setBudget] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Listen for keyboard to adjust modal height on Android
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [])
  );

  const recentClients = useMemo(() => {
    return [...projects]
      .filter((p) => p.last_message_time)
      .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time))
      .slice(0, 3);
  }, [projects]);

  const handleCreateProject = async () => {
    if (!clientName.trim() || !projectName.trim()) return;
    impactMedium();
    try {
      const id = await createProject(clientName.trim(), projectName.trim(), '', parseFloat(budget) || 0);
      notificationSuccess();
      setShowNewProject(false);
      setClientName('');
      setProjectName('');
      setBudget('');
      if (id) {
        router.push(`/project-dashboard/${id}`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const totalIncoming = projects.reduce((sum, p) => sum + p.total_incoming, 0);
  const totalExpense = projects.reduce((sum, p) => sum + p.total_expense, 0);
  const netBalance = totalIncoming - totalExpense;

  // ---- Header: Logo bar ----
  const TopHeader = () => (
    <Animated.View entering={FadeIn.duration(500)} style={styles.topHeader}>
      <View style={styles.topHeaderLeft}>
        <LedgeLogo size={34} />
        <View style={styles.topHeaderBrand}>
          <Text style={styles.topHeaderTitle}>ledge</Text>
        </View>
      </View>
      <View style={styles.topHeaderRight}>
        {isAdmin && (
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => router.push('/admin/users')}
          >
            <IconButton icon="shield-account-outline" iconColor={theme.colors.accent} size={20} style={{ margin: 0 }} />
          </Pressable>
        )}
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => router.push('/settings')}
        >
          <IconButton icon="cog-outline" iconColor={theme.colors.onSurfaceVariant} size={20} style={{ margin: 0 }} />
        </Pressable>
      </View>
    </Animated.View>
  );

  // ---- Balance Card ----
  const BalanceCard = () => (
    projects.length > 0 ? (
      <Animated.View entering={FadeInDown.delay(100).springify().damping(20).stiffness(100)} style={styles.balanceCard}>
        <View style={styles.balanceCardHeader}>
          <Text style={styles.balanceLabel}>NET BALANCE</Text>
          <View style={[styles.statusDot, { backgroundColor: netBalance >= 0 ? theme.colors.incoming : theme.colors.expense }]} />
        </View>
        <Text
          style={[
            styles.balanceAmount,
            { color: netBalance >= 0 ? theme.colors.incoming : theme.colors.expense },
          ]}
        >
          {formatRupees(Math.abs(netBalance))}
        </Text>

        <View style={styles.balanceSplit}>
          <View style={[styles.balanceSplitItem, { backgroundColor: theme.colors.incomingBg }]}>
            <View style={styles.balanceSplitRow}>
              <View style={[styles.balanceDot, { backgroundColor: theme.colors.incoming }]} />
              <Text style={styles.balanceSplitLabel}>Income</Text>
            </View>
            <Text style={[styles.balanceSplitAmount, { color: theme.colors.incoming }]}>
              {formatRupees(totalIncoming)}
            </Text>
          </View>

          <View style={{ width: 10 }} />

          <View style={[styles.balanceSplitItem, { backgroundColor: theme.colors.expenseBg }]}>
            <View style={styles.balanceSplitRow}>
              <View style={[styles.balanceDot, { backgroundColor: theme.colors.expense }]} />
              <Text style={styles.balanceSplitLabel}>Expense</Text>
            </View>
            <Text style={[styles.balanceSplitAmount, { color: theme.colors.expense }]}>
              {formatRupees(totalExpense)}
            </Text>
          </View>
        </View>
      </Animated.View>
    ) : null
  );

  // ---- Quick Actions Row ----
  const QuickActions = () => (
    <Animated.View entering={FadeIn.delay(200)} style={styles.quickActionsSection}>
      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="plus-circle-outline"
          label="New Project"
          sublabel="create"
          onPress={() => setShowNewProject(true)}
          delay={200}
          color="rgba(74,222,128,0.15)"
        />
        <View style={{ width: 10 }} />
        <QuickAction
          icon="chart-arc"
          label="Dashboard"
          sublabel="analytics"
          onPress={() => router.push('/dashboard')}
          delay={260}
          color="rgba(139,115,253,0.15)"
        />
        <View style={{ width: 10 }} />
        <QuickAction
          icon="account-group-outline"
          label="Recents"
          sublabel="clients"
          onPress={() => setShowRecentClients(true)}
          delay={320}
          color="rgba(251,113,133,0.15)"
        />
      </View>
    </Animated.View>
  );

  // ---- Projects Section Header ----
  const ProjectsHeader = () => (
    projects.length > 0 ? (
      <Animated.View entering={FadeIn.delay(300)} style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>YOUR PROJECTS ({projects.length})</Text>
      </Animated.View>
    ) : null
  );

  const ListHeader = () => (
    <View style={[styles.listHeader, { paddingTop: Math.max(12, insets.top + 8) }]}>
      <TopHeader />
      <BalanceCard />
      <QuickActions />
      <ProjectsHeader />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        renderItem={({ item, index }) => (
          <ProjectCard item={item} index={index} onPress={(id) => router.push(`/project-dashboard/${id}`)} />
        )}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContent,
          projects.length === 0 && styles.emptyContainer,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(400).duration(800)} style={styles.emptyState}>
            <View style={styles.emptyIconOuter}>
              <View style={styles.emptyIconInner}>
                <IconButton icon="folder-plus-outline" iconColor={theme.colors.primary} size={32} style={{ margin: 0 }} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No Projects Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "New Project" above to start{'\n'}tracking your first project
            </Text>
          </Animated.View>
        }
      />

      {/* ---- Bottom Navigation ---- */}
      <Animated.View entering={FadeInUp.delay(400).springify().damping(20)} style={[styles.bottomNav, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <NavButton icon="home-variant" label="Home" isActive onPress={() => {}} />
        <NavButton icon="view-dashboard-outline" label="Dashboard" onPress={() => router.push('/dashboard')} />

        {/* Center FAB */}
        <View style={styles.fabContainer}>
          <Pressable
            style={styles.fabButton}
            onPress={() => { impactMedium(); setShowNewProject(true); }}
          >
            <IconButton icon="plus" iconColor="#080808" size={26} style={{ margin: 0 }} />
          </Pressable>
        </View>

        <NavButton icon="clock-outline" label="Recents" onPress={() => setShowRecentClients(true)} />
        <NavButton icon="cog-outline" label="Settings" onPress={() => router.push('/settings')} />
      </Animated.View>

      {/* ---- New Project Modal ---- */}
      <Portal>
        <Modal
          visible={showNewProject}
          onDismiss={() => setShowNewProject(false)}
          contentContainerStyle={[
            styles.modal,
            { paddingBottom: Math.max(40, insets.bottom + 24) },
            keyboardHeight > 0 && {
              marginBottom: Math.max(0, keyboardHeight - insets.bottom),
              maxHeight: Dimensions.get('window').height - keyboardHeight - 80,
            },
          ]}
          style={styles.modalOverlay}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Project</Text>
            <Text style={styles.modalSubtitle}>Set up a new project to track finances</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Client Name</Text>
              <TextInput
                value={clientName}
                onChangeText={setClientName}
                style={styles.input}
                mode="outlined"
                placeholder="Enter client name"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={styles.inputOutline}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Project Name</Text>
              <TextInput
                value={projectName}
                onChangeText={setProjectName}
                style={styles.input}
                mode="outlined"
                placeholder="Enter project name"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={styles.inputOutline}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Budget (Optional)</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                style={styles.input}
                mode="outlined"
                placeholder="₹0"
                placeholderTextColor={theme.colors.secondary}
                keyboardType="numeric"
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={styles.inputOutline}
                theme={{ roundness: 12 }}
              />
            </View>

            <Pressable
              style={[styles.createButton, (!clientName.trim() || !projectName.trim()) && styles.createButtonDisabled]}
              onPress={handleCreateProject}
              disabled={!clientName.trim() || !projectName.trim()}
            >
              <Text style={styles.createButtonText}>Create Project</Text>
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => setShowNewProject(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ---- Recent Clients Modal ---- */}
      <Portal>
        <Modal
          visible={showRecentClients}
          onDismiss={() => setShowRecentClients(false)}
          contentContainerStyle={styles.recentsModal}
          style={styles.modalOverlay}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.recentsTitle}>Recent Clients</Text>
          <Text style={styles.recentsSubtitle}>Quick access to your latest projects</Text>

          {recentClients.length > 0 ? (
            <View style={styles.recentsList}>
              {recentClients.map((project, idx) => {
                const getInitials = (name) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                const balance = project.total_incoming - project.total_expense;
                return (
                  <Pressable
                    key={project.id}
                    style={[styles.recentItem, idx < recentClients.length - 1 && styles.recentItemBorder]}
                    onPress={() => {
                      setShowRecentClients(false);
                      router.push(`/project-dashboard/${project.id}`);
                    }}
                  >
                    <View style={styles.recentAvatar}>
                      <Text style={styles.recentAvatarText}>{getInitials(project.client_name)}</Text>
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentClientName} numberOfLines={1}>{project.client_name}</Text>
                      <Text style={styles.recentProjectName} numberOfLines={1}>{project.project_name}</Text>
                    </View>
                    <View style={[styles.recentBadge, { backgroundColor: balance >= 0 ? theme.colors.incomingMuted : theme.colors.expenseMuted }]}>
                      <Text style={[styles.recentBadgeText, { color: balance >= 0 ? theme.colors.incoming : theme.colors.expense }]}>
                        {formatRupees(Math.abs(balance))}
                      </Text>
                    </View>
                    <IconButton icon="chevron-right" iconColor={theme.colors.secondary} size={18} style={{ margin: 0 }} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.recentsEmpty}>
              <IconButton icon="account-clock-outline" iconColor={theme.colors.secondary} size={32} style={{ margin: 0 }} />
              <Text style={styles.recentsEmptyText}>No recent activity yet</Text>
            </View>
          )}

          <Pressable style={styles.cancelButton} onPress={() => setShowRecentClients(false)}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </Pressable>
        </Modal>
      </Portal>
    </View>
  );
}

// =============== STYLES ===============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // List
  listContent: {
    paddingBottom: 120,
  },
  listHeader: {},
  emptyContainer: {
    flexGrow: 1,
  },

  // ---- Top Header ----
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topHeaderBrand: {
    justifyContent: 'center',
  },
  topHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: 1,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },

  // ---- Balance Card ----
  balanceCard: {
    marginHorizontal: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  balanceSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  balanceSplitItem: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  balanceSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  balanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  balanceSplitLabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  balanceSplitAmount: {
    fontSize: 16,
    fontWeight: '700',
  },

  // ---- Quick Actions ----
  quickActionsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  quickActionCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  quickActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionSublabel: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // ---- Section Header ----
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.secondary,
    letterSpacing: 1.5,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  // ---- Project Card ----
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  projectInfo: {
    flex: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.onSurface,
    flex: 1,
    letterSpacing: 0.2,
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.secondary,
    marginLeft: 8,
    fontWeight: '500',
  },
  projectTitle: {
    fontSize: 12,
    color: theme.colors.accent,
    marginBottom: 5,
    fontWeight: '500',
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 12,
    color: theme.colors.secondary,
    flex: 1,
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  balanceTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ---- Empty State ----
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  emptyIconInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ---- Bottom Navigation ----
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 56,
  },
  navLabel: {
    fontSize: 10,
    color: theme.colors.secondary,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },

  // ---- Center FAB ----
  fabContainer: {
    alignItems: 'center',
    marginTop: -28,
  },
  fabButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8E8E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  // ---- Modal ----
  modalOverlay: {
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.secondary,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.surface,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 12,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.35,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080808',
    letterSpacing: 0.3,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.secondary,
  },

  // ---- Recent Clients Modal ----
  recentsModal: {
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderBottomWidth: 0,
  },
  recentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  recentsSubtitle: {
    fontSize: 13,
    color: theme.colors.secondary,
    marginBottom: 20,
  },
  recentsList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
    marginBottom: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  recentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  recentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentAvatarText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  recentInfo: {
    flex: 1,
  },
  recentClientName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
  },
  recentProjectName: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '500',
    marginTop: 2,
  },
  recentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  recentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  recentsEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  recentsEmptyText: {
    fontSize: 14,
    color: theme.colors.secondary,
    marginTop: 8,
  },
});
