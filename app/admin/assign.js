import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, IconButton, Chip } from 'react-native-paper';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { theme } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useAppStore } from '../../src/stores/appStore';
import {
  listAllUsers,
  getProjectMembers,
  assignUserToProject,
  removeUserFromProject,
} from '../../src/services/adminApi';

export default function ProjectAssignment() {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const projects = useAppStore((s) => s.projects);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const [users, setUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
      loadAllUsers();
    }, [])
  );

  const loadAllUsers = async () => {
    try {
      const data = await listAllUsers();
      setUsers(data || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const loadMembers = async (projectId) => {
    setIsLoading(true);
    try {
      const data = await getProjectMembers(projectId);
      setMembers(data || []);
    } catch (e) {
      console.error('Failed to load members:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    loadMembers(project.id);
  };

  const handleToggleMember = async (user) => {
    if (!selectedProject) return;

    const isMember = members.some((m) => m.user_id === user.id);
    try {
      if (isMember) {
        await removeUserFromProject(selectedProject.id, user.id);
      } else {
        await assignUserToProject(selectedProject.id, user.id);
      }
      await loadMembers(selectedProject.id);
    } catch (e) {
      console.error('Failed to toggle member:', e);
    }
  };

  const isMember = (userId) => members.some((m) => m.user_id === userId);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Access denied. Admin only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Project Assignment</Text>
          <Text style={styles.headerSubtitle}>Assign users to projects</Text>
        </View>
      </Animated.View>

      {/* Project Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SELECT PROJECT</Text>
        <FlatList
          horizontal
          data={projects}
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.projectChips}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.projectChip,
                selectedProject?.id === item.id && styles.projectChipActive,
              ]}
              onPress={() => handleSelectProject(item)}
            >
              <Text
                style={[
                  styles.projectChipText,
                  selectedProject?.id === item.id && styles.projectChipTextActive,
                ]}
                numberOfLines={1}
              >
                {item.client_name} - {item.project_name}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyChipText}>No projects yet. Create one first.</Text>
          }
        />
      </View>

      {/* User List with Checkboxes */}
      {selectedProject ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              MEMBERS ({members.length})
            </Text>
          </View>
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.userList}
            showsVerticalScrollIndicator={false}
            refreshing={isLoading}
            onRefresh={() => loadMembers(selectedProject.id)}
            renderItem={({ item, index }) => {
              const assigned = isMember(item.id);
              return (
                <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(20)}>
                  <Pressable
                    style={[styles.userRow, assigned && styles.userRowActive]}
                    onPress={() => handleToggleMember(item)}
                  >
                    <View style={[styles.checkbox, assigned && styles.checkboxActive]}>
                      {assigned && (
                        <IconButton icon="check" iconColor="#080808" size={14} style={{ margin: 0 }} />
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {item.display_name || item.email.split('@')[0]}
                      </Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                    <Chip
                      style={[styles.roleBadge, item.role === 'admin' ? styles.adminBadge : styles.memberBadge]}
                      textStyle={[styles.roleBadgeText, item.role === 'admin' ? styles.adminBadgeText : styles.memberBadgeText]}
                      compact
                    >
                      {item.role}
                    </Chip>
                  </Pressable>
                </Animated.View>
              );
            }}
          />
        </>
      ) : (
        <View style={styles.selectPrompt}>
          <IconButton icon="hand-pointing-up" iconColor={theme.colors.secondary} size={36} />
          <Text style={styles.selectPromptText}>Select a project above to manage members</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 56,
    paddingBottom: 16,
    gap: 4,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.onSurface },
  headerSubtitle: { fontSize: 13, color: theme.colors.secondary, marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.secondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  projectChips: { paddingRight: 16, gap: 8 },
  projectChip: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    maxWidth: 200,
  },
  projectChipActive: {
    backgroundColor: theme.colors.accentContainer,
    borderColor: theme.colors.accent,
  },
  projectChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  projectChipTextActive: { color: theme.colors.accent },
  emptyChipText: { fontSize: 13, color: theme.colors.secondary },
  userList: { paddingHorizontal: 16, paddingBottom: 40 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  userRowActive: {
    borderColor: theme.colors.incoming,
    backgroundColor: 'rgba(74,222,128,0.04)',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.colors.incoming,
    borderColor: theme.colors.incoming,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurface },
  userEmail: { fontSize: 12, color: theme.colors.secondary, marginTop: 2 },
  roleBadge: { height: 24 },
  adminBadge: { backgroundColor: theme.colors.accentContainer },
  adminBadgeText: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' },
  memberBadge: { backgroundColor: theme.colors.surfaceHighlight },
  memberBadgeText: { color: theme.colors.secondary, fontSize: 11, fontWeight: '600' },
  selectPrompt: { alignItems: 'center', marginTop: 60 },
  selectPromptText: { fontSize: 14, color: theme.colors.secondary, marginTop: 8 },
  errorText: { color: theme.colors.expense, textAlign: 'center', marginTop: 100, fontSize: 16 },
});
