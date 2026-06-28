import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareIntentContext } from 'expo-share-intent';
import { getPendingShares, clearPendingShares } from '../modules/ledge-share-handler';
import { theme, formatRupees } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';
import { impactLight } from '../src/utils/haptics';
import { saveShareHandoff } from '../src/utils/shareHandoff';

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------

function ProjectCard({ project, index, onPress, disabled }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const balance = project.total_incoming - project.total_expense;

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 55).springify().damping(18)}
      style={animStyle}
    >
      <Pressable
        style={[styles.projectCard, disabled && styles.projectCardDisabled]}
        onPressIn={() => {
          if (!disabled) scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
        onPress={() => {
          if (!disabled) { impactLight(); onPress(project); }
        }}
      >
        <View style={styles.projectAvatar}>
          <Text style={styles.projectAvatarText}>{getInitials(project.client_name)}</Text>
        </View>
        <View style={styles.projectInfo}>
          <Text style={styles.projectClientName} numberOfLines={1}>{project.client_name}</Text>
          <Text style={styles.projectProjectName} numberOfLines={1}>{project.project_name}</Text>
        </View>
        <View style={styles.projectBalance}>
          <Text style={[
            styles.projectBalanceAmount,
            { color: balance >= 0 ? theme.colors.incoming : theme.colors.expense },
          ]}>
            {formatRupees(Math.abs(balance))}
          </Text>
        </View>
        <IconButton icon="chevron-right" iconColor={theme.colors.secondary} size={20} style={{ margin: 0 }} />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { projects, loadProjects } = useAppStore();

  // The resolved share data — always a stable file:// path or plain text.
  const [shareData, setShareData] = useState(null);
  // Null = still resolving; true/false = done loading.
  const [isReady, setIsReady] = useState(false);
  const resolveAttempts = useRef(0);

  // Load projects on mount.
  useEffect(() => { loadProjects(); }, []);

  // ---------------------------------------------------------------------------
  // Resolve share data from both sources:
  //   1. Native module (LedgeShareHandler) — highest priority.
  //      The module copies content:// URIs to file:// cache in OnCreate /
  //      OnNewIntent BEFORE any JS runs, so this path is always race-free.
  //   2. expo-share-intent — fallback if the native module is not compiled
  //      (e.g. during development with the JS-only web bundle).
  // ---------------------------------------------------------------------------
  const resolveShareData = useCallback(async () => {
    // 1. Try native module first.
    try {
      const pending = await getPendingShares();
      if (pending.length > 0) {
        const share = pending[0];
        setShareData({
          imageUri: share.type === 'file' ? share.path : null,
          text: share.text || null,
          source: 'native',
        });
        resolveAttempts.current = 0;
        setIsReady(true);
        return;
      }
    } catch (e) {
      console.warn('[share] getPendingShares error:', e);
    }

    // 2. Fall back to expo-share-intent.
    if (hasShareIntent && shareIntent) {
      const rawFile = shareIntent.files?.[0] ?? null;
      let imageUri = rawFile?.path || rawFile?.contentUri || null;
      const text = shareIntent.text || shareIntent.webUrl || null;

      if (imageUri) {
        // Normalize bare paths to file:// so RN Image can load them.
        if (imageUri.startsWith('/')) imageUri = 'file://' + imageUri;
      }

      setShareData({ imageUri: imageUri ?? null, text: text ?? null, source: 'expo' });
      resolveAttempts.current = 0;
      setIsReady(true);
      return;
    }

    // Nothing yet — mark ready with no data so we can show the empty state.
    if (resolveAttempts.current < 12) {
      resolveAttempts.current += 1;
      setIsReady(false);
      setTimeout(resolveShareData, 250);
      return;
    }

    setIsReady(true);
  }, [hasShareIntent, shareIntent]);

  useEffect(() => {
    resolveAttempts.current = 0;
    resolveShareData();
  }, [resolveShareData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    resetShareIntent();
    clearPendingShares();
    router.replace('/');
  };

  const handleSelectProject = async (project) => {
    if (!shareData) return;

    // Persist before navigation so the receipt survives route or intent loss.
    const savedShare = await saveShareHandoff(shareData);

    const params = [`shareId=${encodeURIComponent(savedShare.id)}`];
    if (shareData.imageUri) {
      params.push(`sharedImage=${encodeURIComponent(shareData.imageUri)}`);
    }
    if (shareData.text) {
      params.push(`sharedText=${encodeURIComponent(shareData.text)}`);
    }
    params.push(`shareTs=${Date.now()}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    router.replace(`/project/${project.id}${query}`);

    resetShareIntent();
    clearPendingShares();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canSelectProject = isReady && !!shareData && (!!shareData.imageUri || !!shareData.text);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.header, { paddingTop: Math.max(16, insets.top + 8) }]}
      >
        <IconButton
          icon="close"
          iconColor={theme.colors.onSurface}
          size={22}
          onPress={handleClose}
          style={styles.closeButton}
        />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Share to Ledge</Text>
          <Text style={styles.headerSubtitle}>
            {!isReady ? 'Reading receipt…' : canSelectProject ? 'Pick a project' : 'No receipt found'}
          </Text>
        </View>
      </Animated.View>

      {/* Receipt preview */}
      {!isReady && (
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.previewCard}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.previewText}>Reading shared receipt…</Text>
        </Animated.View>
      )}

      {isReady && shareData?.imageUri && (
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.previewCard}>
          <Image
            source={{ uri: shareData.imageUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewMeta}>
            <IconButton icon="image-check" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.previewText}>Receipt image ready</Text>
          </View>
        </Animated.View>
      )}

      {isReady && !shareData?.imageUri && shareData?.text && (
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.previewCard}>
          <View style={styles.previewMeta}>
            <IconButton icon="text-box-check-outline" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.previewText} numberOfLines={2}>{shareData.text}</Text>
          </View>
        </Animated.View>
      )}

      {isReady && !canSelectProject && (
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={[styles.previewCard, styles.errorCard]}>
          <IconButton icon="alert-circle-outline" iconColor={theme.colors.expense} size={20} style={{ margin: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewText, { color: theme.colors.expense }]}>
              No image or text found in the share. Try sharing again from GPay or your banking app.
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Project list */}
      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ProjectCard
            project={item}
            index={index}
            onPress={handleSelectProject}
            disabled={!canSelectProject}
          />
        )}
        ListHeaderComponent={
          canSelectProject ? (
            <Text style={styles.listHeader}>SELECT PROJECT</Text>
          ) : null
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.emptyState}>
            <IconButton icon="folder-plus-outline" iconColor={theme.colors.primary} size={40} style={{ margin: 0 }} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a project first, then share receipts to it from GPay or your bank app.
            </Text>
          </Animated.View>
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  closeButton: {
    borderRadius: 20,
    marginRight: 6,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  previewCard: {
    margin: 16,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  previewText: {
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
    flex: 1,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  listHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.secondary,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  listContent: {
    padding: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  projectCardDisabled: {
    opacity: 0.45,
  },
  projectAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  projectAvatarText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  projectInfo: {
    flex: 1,
  },
  projectClientName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
  },
  projectProjectName: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  projectBalance: {
    marginRight: 4,
  },
  projectBalanceAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});
