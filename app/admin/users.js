import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Pressable, ScrollView, Keyboard, Dimensions, Platform } from 'react-native';
import { Text, TextInput, Portal, Modal, IconButton, Chip } from 'react-native-paper';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { theme } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { createUserAccount, listAllUsers, setUserRole } from '../../src/services/adminApi';

export default function UserManagement() {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const data = await listAllUsers();
      setUsers(data || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const handleCreateUser = async () => {
    if (!email.trim() || !password) {
      setCreateError('Email and password are required');
      return;
    }
    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }

    setCreateError('');
    setIsCreating(true);
    try {
      await createUserAccount(email.trim(), password, displayName.trim());
      setShowCreateModal(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
      await loadUsers();
    } catch (e) {
      console.error('Create user error:', e);
      setCreateError(e.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await setUserRole(user.id, newRole);
      await loadUsers();
    } catch (e) {
      console.error('Failed to update role:', e);
    }
  };

  const getInitials = (name, email) => {
    if (name) {
      return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const renderUser = ({ item, index }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(20)}>
      <View style={styles.userCard}>
        <View style={[styles.avatar, item.role === 'admin' && styles.avatarAdmin]}>
          <Text style={styles.avatarText}>{getInitials(item.display_name, item.email)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.display_name || item.email.split('@')[0]}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userBadges}>
            <Chip
              style={[styles.roleBadge, item.role === 'admin' ? styles.adminBadge : styles.userBadge]}
              textStyle={[styles.roleBadgeText, item.role === 'admin' ? styles.adminBadgeText : styles.userBadgeText]}
              compact
            >
              {item.role}
            </Chip>
            {item.must_change_password && (
              <Chip style={styles.pendingBadge} textStyle={styles.pendingBadgeText} compact>
                pending setup
              </Chip>
            )}
          </View>
        </View>
        <Pressable style={styles.roleToggle} onPress={() => handleToggleRole(item)}>
          <IconButton
            icon={item.role === 'admin' ? 'shield-account' : 'account'}
            iconColor={item.role === 'admin' ? theme.colors.accent : theme.colors.secondary}
            size={20}
            style={{ margin: 0 }}
          />
        </Pressable>
      </View>
    </Animated.View>
  );

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
          <Text style={styles.headerTitle}>User Management</Text>
          <Text style={styles.headerSubtitle}>{users.length} user{users.length !== 1 ? 's' : ''}</Text>
        </View>
      </Animated.View>

      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadUsers}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconButton icon="account-group-outline" iconColor={theme.colors.secondary} size={40} />
            <Text style={styles.emptyText}>No users yet</Text>
            <Text style={styles.emptySubtext}>Create the first user account</Text>
          </View>
        }
      />

      {/* Create User FAB */}
      <Pressable style={styles.fab} onPress={() => setShowCreateModal(true)}>
        <IconButton icon="account-plus" iconColor="#080808" size={24} style={{ margin: 0 }} />
      </Pressable>

      {/* Create User Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => { setShowCreateModal(false); setCreateError(''); }}
          contentContainerStyle={[
            styles.modal,
            keyboardHeight > 0 && {
              marginBottom: keyboardHeight,
              maxHeight: Dimensions.get('window').height - keyboardHeight - 80,
            },
          ]}
          style={styles.modalOverlay}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create New User</Text>
            <Text style={styles.modalSubtitle}>User will be prompted to change password on first login</Text>

            {createError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{createError}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DISPLAY NAME</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                style={styles.input}
                mode="outlined"
                placeholder="Full name"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.accent}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={(t) => { setEmail(t); setCreateError(''); }}
                style={styles.input}
                mode="outlined"
                placeholder="user@example.com"
                placeholderTextColor={theme.colors.secondary}
                keyboardType="email-address"
                autoCapitalize="none"
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.accent}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TEMPORARY PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={(t) => { setPassword(t); setCreateError(''); }}
                style={styles.input}
                mode="outlined"
                placeholder="Min 6 characters"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.accent}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <Pressable
              style={[styles.createButton, isCreating && styles.createButtonDisabled]}
              onPress={handleCreateUser}
              disabled={isCreating}
            >
              <Text style={styles.createButtonText}>
                {isCreating ? 'Creating...' : 'Create User'}
              </Text>
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => { setShowCreateModal(false); setCreateError(''); }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Modal>
      </Portal>
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
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
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
  },
  avatarAdmin: { backgroundColor: theme.colors.accentContainer },
  avatarText: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: theme.colors.onSurface },
  userEmail: { fontSize: 13, color: theme.colors.secondary, marginTop: 2 },
  userBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  roleBadge: { height: 24 },
  adminBadge: { backgroundColor: theme.colors.accentContainer },
  adminBadgeText: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' },
  userBadge: { backgroundColor: theme.colors.surfaceHighlight },
  userBadgeText: { color: theme.colors.secondary, fontSize: 11, fontWeight: '600' },
  pendingBadge: { backgroundColor: theme.colors.expenseMuted, height: 24 },
  pendingBadgeText: { color: theme.colors.expense, fontSize: 11, fontWeight: '600' },
  roleToggle: { padding: 4 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: theme.colors.onSurface, marginTop: 8 },
  emptySubtext: { fontSize: 14, color: theme.colors.secondary, marginTop: 4 },
  errorText: { color: theme.colors.expense, textAlign: 'center', marginTop: 100, fontSize: 16 },
  modalOverlay: { justifyContent: 'flex-end' },
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
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.secondary,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: theme.colors.secondary, marginBottom: 20 },
  errorBanner: {
    backgroundColor: theme.colors.expenseMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { color: theme.colors.expense, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.secondary, letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, fontSize: 15 },
  createButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { fontSize: 16, fontWeight: '700', color: '#080808' },
  cancelButton: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { fontSize: 15, fontWeight: '500', color: theme.colors.secondary },
});
