import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, IconButton, Text, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { TEAM_ROLE_OPTIONS, SUBSCRIPTION_PLANS, getRoleOption } from '../src/constants/access';
import { theme } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useTeamStore } from '../src/stores/teamStore';

function RoleOption({ option, selected, onPress }) {
  return (
    <Pressable
      style={[styles.roleOption, selected && styles.roleOptionActive]}
      onPress={onPress}
    >
      <IconButton
        icon={option.icon}
        iconColor={selected ? theme.colors.accent : theme.colors.secondary}
        size={18}
        style={{ margin: 0 }}
      />
      <View style={styles.roleOptionText}>
        <Text style={[styles.roleName, selected && { color: theme.colors.accent }]}>
          {option.label}
        </Text>
        <Text style={styles.roleDescription} numberOfLines={2}>
          {option.description}
        </Text>
      </View>
    </Pressable>
  );
}

function MemberRow({ item, canManage, onRoleChange, onRemove }) {
  const role = getRoleOption(item.role);

  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <View style={styles.memberRow}>
        <View style={[styles.memberAvatar, item.role === 'admin' && styles.memberAvatarAdmin]}>
          <Text style={styles.memberAvatarText}>{String(item.email || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberEmail} numberOfLines={1}>{item.email}</Text>
          <View style={styles.memberBadges}>
            <Chip compact style={styles.memberRoleBadge} textStyle={styles.memberRoleText}>
              {role.label}
            </Chip>
            <Chip compact style={styles.statusBadge} textStyle={styles.statusText}>
              {item.status || 'invited'}
            </Chip>
          </View>
        </View>
        {canManage && (
          <View style={styles.memberActions}>
            <IconButton
              icon="account-switch-outline"
              iconColor={theme.colors.primary}
              size={20}
              style={{ margin: 0 }}
              onPress={() => onRoleChange(item)}
            />
            <IconButton
              icon="close"
              iconColor={theme.colors.expense}
              size={20}
              style={{ margin: 0 }}
              onPress={() => onRemove(item)}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function TeamScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    team,
    members,
    projectLimit,
    isLoading,
    error,
    loadTeam,
    ensureTeam,
    inviteMember,
    setMemberRole,
    removeMember,
  } = useTeamStore();

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState(TEAM_ROLE_OPTIONS[0].id);
  const [screenError, setScreenError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTeam().catch((e) => setScreenError(e.message || 'Could not load team'));
    }, [loadTeam])
  );

  const currentRole = team?.currentMember?.role || 'admin';
  const canManage = currentRole === 'admin' || profile?.role === 'admin';
  const plan = projectLimit?.plan || SUBSCRIPTION_PLANS.FREE;
  const memberRows = useMemo(() => {
    if (members.length) return members;
    if (team?.currentMember?.email) {
      return [{ id: 'current', ...team.currentMember }];
    }
    return [];
  }, [members, team]);

  const handleCreateTeam = async () => {
    setIsSaving(true);
    setScreenError('');
    try {
      await ensureTeam(team?.name || 'My Team');
    } catch (e) {
      setScreenError(e.message || 'Could not create team');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    setIsSaving(true);
    setScreenError('');
    try {
      await inviteMember(email, selectedRole);
      setEmail('');
      setSelectedRole(TEAM_ROLE_OPTIONS[0].id);
    } catch (e) {
      setScreenError(e.message || 'Could not add member');
    } finally {
      setIsSaving(false);
    }
  };

  const cycleRole = async (member) => {
    const index = TEAM_ROLE_OPTIONS.findIndex((option) => option.id === member.role);
    const next = TEAM_ROLE_OPTIONS[(index + 1) % TEAM_ROLE_OPTIONS.length];
    setIsSaving(true);
    setScreenError('');
    try {
      await setMemberRole(member.id, next.id);
    } catch (e) {
      setScreenError(e.message || 'Could not update role');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (member) => {
    setIsSaving(true);
    setScreenError('');
    try {
      await removeMember(member.id);
    } catch (e) {
      setScreenError(e.message || 'Could not remove member');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(260)} style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')} style={styles.backButton}>
          <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Team</Text>
          <Text style={styles.headerSubtitle}>Roles, members, and plan limits</Text>
        </View>
      </Animated.View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {(screenError || error) ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{screenError || error}</Text>
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(80).duration(240)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconButton icon="account-group-outline" iconColor={theme.colors.accent} size={22} style={styles.sectionIcon} />
            <View>
              <Text style={styles.sectionTitle}>{team?.name || 'My Team'}</Text>
              <Text style={styles.sectionTag}>{team?.backendReady ? 'Team workspace active' : 'Local preview until team tables are applied'}</Text>
            </View>
          </View>

          {!team?.backendReady && (
            <Text style={styles.sectionDesc}>
              Apply the Supabase team migration after OAuth is merged. Until then, this screen shows the access model and enforces the free project limit locally.
            </Text>
          )}

          {!team?.id && canManage && (
            <Pressable style={[styles.primaryButton, isSaving && styles.disabled]} onPress={handleCreateTeam} disabled={isSaving}>
              <Text style={styles.primaryButtonText}>{isSaving ? 'Creating...' : 'Create Team Workspace'}</Text>
            </Pressable>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(240)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconButton icon="credit-card-outline" iconColor={theme.colors.primary} size={22} style={styles.sectionIcon} />
            <View>
              <Text style={styles.sectionTitle}>Subscription</Text>
              <Text style={styles.sectionTag}>{plan.label} plan</Text>
            </View>
          </View>
          <View style={styles.planGrid}>
            <View style={styles.planMetric}>
              <Text style={styles.planMetricValue}>{projectLimit?.used ?? 0}</Text>
              <Text style={styles.planMetricLabel}>Projects used</Text>
            </View>
            <View style={styles.planMetric}>
              <Text style={styles.planMetricValue}>{plan.projectLimit}</Text>
              <Text style={styles.planMetricLabel}>Project limit</Text>
            </View>
            <View style={styles.planMetric}>
              <Text style={styles.planMetricValue}>Unlimited</Text>
              <Text style={styles.planMetricLabel}>Members</Text>
            </View>
          </View>
          <Text style={styles.sectionDesc}>
            Free includes 1 unlimited-use project. Pro is ₹299/month for up to 10 projects and unlimited team members.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(240)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconButton icon="shield-key-outline" iconColor={theme.colors.primary} size={22} style={styles.sectionIcon} />
            <View>
              <Text style={styles.sectionTitle}>Access Levels</Text>
              <Text style={styles.sectionTag}>Project-safe roles</Text>
            </View>
          </View>
          {TEAM_ROLE_OPTIONS.map((option) => (
            <RoleOption
              key={option.id}
              option={option}
              selected={selectedRole === option.id}
              onPress={() => setSelectedRole(option.id)}
            />
          ))}
        </Animated.View>

        {canManage && (
          <Animated.View entering={FadeInDown.delay(200).duration(240)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconButton icon="account-plus-outline" iconColor={theme.colors.accent} size={22} style={styles.sectionIcon} />
              <View>
                <Text style={styles.sectionTitle}>Add Member</Text>
                <Text style={styles.sectionTag}>Invite by email</Text>
              </View>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              placeholder="member@example.com"
              placeholderTextColor={theme.colors.secondary}
              keyboardType="email-address"
              autoCapitalize="none"
              textColor={theme.colors.onSurface}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.accent}
              theme={{ roundness: 12 }}
            />
            <Pressable
              style={[styles.primaryButton, (!email.trim() || isSaving || !team?.id) && styles.disabled]}
              onPress={handleInvite}
              disabled={!email.trim() || isSaving || !team?.id}
            >
              <Text style={styles.primaryButtonText}>{team?.id ? 'Add Member' : 'Create team first'}</Text>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(240).duration(240)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconButton icon="account-multiple-check-outline" iconColor={theme.colors.primary} size={22} style={styles.sectionIcon} />
            <View>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.sectionTag}>{memberRows.length} member{memberRows.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
          {memberRows.length ? (
            memberRows.map((item) => (
              <MemberRow
                key={String(item.id)}
                item={item}
                canManage={canManage && item.id !== 'current'}
                onRoleChange={cycleRole}
                onRemove={remove}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No members yet.</Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  headerSubtitle: { fontSize: 12, color: theme.colors.secondary, marginTop: 2 },
  content: { flex: 1 },
  contentContainer: { padding: 16, gap: 14, paddingBottom: 40 },
  section: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIcon: { margin: 0, backgroundColor: theme.colors.surfaceHighlight },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  sectionTag: { fontSize: 11, color: theme.colors.secondary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  sectionDesc: { fontSize: 13, lineHeight: 19, color: theme.colors.secondary, marginTop: 4 },
  errorBanner: { backgroundColor: theme.colors.expenseMuted, borderRadius: 12, padding: 12 },
  errorText: { color: theme.colors.expense, fontSize: 13, fontWeight: '600' },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  roleOptionActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentContainer },
  roleOptionText: { flex: 1 },
  roleName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  roleDescription: { fontSize: 12, color: theme.colors.secondary, lineHeight: 17, marginTop: 2 },
  planGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  planMetric: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: 10,
  },
  planMetricValue: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  planMetricLabel: { fontSize: 10, color: theme.colors.secondary, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: theme.colors.surface, fontSize: 14, marginBottom: 12 },
  inputOutline: { borderRadius: 12 },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#080808', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarAdmin: { backgroundColor: theme.colors.accentContainer },
  memberAvatarText: { color: theme.colors.primary, fontWeight: '800' },
  memberInfo: { flex: 1 },
  memberEmail: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700' },
  memberBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  memberRoleBadge: { height: 24, backgroundColor: theme.colors.surfaceHighlight },
  memberRoleText: { color: theme.colors.primary, fontSize: 10, fontWeight: '700' },
  statusBadge: { height: 24, backgroundColor: theme.colors.incomingMuted },
  statusText: { color: theme.colors.incoming, fontSize: 10, fontWeight: '700' },
  memberActions: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { color: theme.colors.secondary, fontSize: 13 },
});
