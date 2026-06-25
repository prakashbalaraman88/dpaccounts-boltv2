import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, Platform } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import * as FileSystem from 'expo-file-system';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareIntentContext, ShareIntentModule } from 'expo-share-intent';
import { getPendingShares, clearPendingShares } from '../modules/ledge-share-handler';
import { theme, formatRupees } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';
import { impactLight } from '../src/utils/haptics';

function ProjectCard({ project, index, onPress }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const balance = project.total_incoming - project.total_expense;

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 60).springify().damping(18)}
      style={animStyle}
    >
      <Pressable
        style={styles.projectCard}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 200 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
        onPress={() => { impactLight(); onPress(project); }}
      >
        <View style={styles.projectAvatar}>
          <Text style={styles.projectAvatarText}>{getInitials(project.client_name)}</Text>
        </View>
        <View style={styles.projectInfo}>
          <Text style={styles.projectClientName} numberOfLines={1}>{project.client_name}</Text>
          <Text style={styles.projectProjectName} numberOfLines={1}>{project.project_name}</Text>
        </View>
        <View style={styles.projectBalance}>
          <Text style={[styles.projectBalanceAmount, { color: balance >= 0 ? theme.colors.incoming : theme.colors.expense }]}>
            {formatRupees(Math.abs(balance))}
          </Text>
        </View>
        <IconButton icon="chevron-right" iconColor={theme.colors.secondary} size={20} style={{ margin: 0 }} />
      </Pressable>
    </Animated.View>
  );
}

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareError } = useShareIntentContext();
  const { projects, loadProjects } = useAppStore();
  const [imageUri, setImageUri] = useState(null);
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [refreshTs, setRefreshTs] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [nativeShareData, setNativeShareData] = useState(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // ---- NEW: WhatsApp-style native share fallback ----
  // The LedgeShareHandler native module copies content:// URIs to persistent
  // cache immediately in onCreate/onNewIntent. We poll for those copies here
  // as a fallback when expo-share-intent's URI has expired or is corrupted.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    const check = async () => {
      if (cancelled) return;
      try {
        const shares = await getPendingShares();
        if (!cancelled && shares.length > 0) {
          setNativeShareData(shares[0]);
        }
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 1200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const rawFile = shareIntent?.files?.[0] || null;
  const sharedImageUri = rawFile?.path || rawFile?.contentUri || nativeShareData?.path || null;
  const sharedText = shareIntent?.text || shareIntent?.webUrl || nativeShareData?.text || null;

  // Ensure we always pass a file:// URI forward. Some share providers give us
  // an absolute path without the scheme, which React Native Image cannot load.
  const normalizeUri = (uri) => {
    if (!uri) return null;
    if (uri.startsWith('content://') || uri.startsWith('file://')) return uri;
    if (uri.startsWith('/')) return 'file://' + uri;
    return uri;
  };

  // Content:// URIs from payment apps can lose their temporary read permission
  // at any moment (especially when the share sheet closes). Copy into our cache
  // as soon as we receive the share, and do not let the user proceed until we
  // have a durable file:// URI.
  useEffect(() => {
    setCopyError(null);
    setImageLoadError(false);
    if (!sharedImageUri) {
      setImageUri(null);
      setIsCopying(false);
      return;
    }

    let cancelled = false;
    const normalized = normalizeUri(sharedImageUri);

    if (normalized.startsWith('content://')) {
      setIsCopying(true);
      setImageUri(null);
      (async () => {
        try {
          const cachePath = FileSystem.cacheDirectory + 'ledge_share_' + Date.now() + '.jpg';
          await FileSystem.copyAsync({ from: normalized, to: cachePath });
          const info = await FileSystem.getInfoAsync(cachePath);
          if (cancelled) return;
          if (info.exists && info.size > 0) {
            setImageUri(cachePath);
          } else {
            throw new Error('Shared image copied as an empty file');
          }
        } catch (e) {
          if (!cancelled) {
            console.warn('Could not cache shared image:', e?.message);
            setCopyError(e?.message || 'Could not read the shared image');
            setImageUri(null);
          }
        } finally {
          if (!cancelled) setIsCopying(false);
        }
      })();
    } else if (normalized.startsWith('file://')) {
      // Verify the file actually exists and is non-empty before showing it.
      setIsCopying(true);
      setImageUri(null);
      (async () => {
        try {
          const info = await FileSystem.getInfoAsync(normalized);
          if (cancelled) return;
          if (info.exists && info.size > 0) {
            setImageUri(normalized);
          } else {
            throw new Error('Shared image file is missing or empty');
          }
        } catch (e) {
          if (!cancelled) {
            setCopyError(e?.message || 'Could not read the shared image');
            setImageUri(null);
          }
        } finally {
          if (!cancelled) setIsCopying(false);
        }
      })();
    } else {
      // Fallback: try to load whatever URI we have (e.g. http://).
      setImageUri(normalized);
      setIsCopying(false);
    }

    return () => { cancelled = true; };
  }, [sharedImageUri, refreshTs]);

  // Safety net: if the native event was missed on warm start, ask the module
  // to re-emit the pending intent after the listeners are ready.
  useEffect(() => {
    if (hasShareIntent) return;
    const timer = setTimeout(() => {
      try {
        ShareIntentModule?.getShareIntent('');
      } catch (e) {
        console.warn('ShareIntentModule.getShareIntent failed:', e);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [hasShareIntent, refreshTs]);

  const handleRefreshShare = () => {
    setRefreshTs(Date.now());
    setNativeShareData(null);
    try {
      ShareIntentModule?.getShareIntent('');
    } catch (e) {
      console.warn('ShareIntentModule.getShareIntent failed:', e);
    }
    // Also check native module for shares
    getPendingShares().then((shares) => {
      if (shares.length > 0) {
        setNativeShareData(shares[0]);
      }
    }).catch(() => {});
  };

  const handleClose = () => {
    resetShareIntent();
    clearPendingShares();
    setNativeShareData(null);
    router.replace('/');
  };

  // If no share data yet, show a waiting state with a retry button. This screen
  // is normally reached through a share intent; if the native event was delayed
  // or missed, the retry button asks the module to re-emit it.
  const hasAnyShareData = hasShareIntent || imageUri || sharedText || nativeShareData;
  if (!hasAnyShareData) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }]}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <IconButton icon="close" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Share Receipt</Text>
            <Text style={styles.headerSubtitle}>Waiting for share…</Text>
          </View>
        </Animated.View>
        <View style={styles.emptyState}>
          <IconButton icon="image-off-outline" iconColor={theme.colors.secondary} size={40} style={{ margin: 0 }} />
          <Text style={styles.emptyTitle}>No share data yet</Text>
          <Text style={styles.emptySubtitle}>If you just shared an image, tap Retry to read it again.</Text>
          <Pressable style={styles.retryButton} onPress={handleRefreshShare}>
            <Text style={styles.retryButtonText}>Retry reading share</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canSelectProject = !isCopying && !copyError;

  const handleSelectProject = (project) => {
    if (!canSelectProject) return;

    // Reset BEFORE navigating: a lingering hasShareIntent makes the
    // _layout gate bounce the user back to this screen on re-renders.
    resetShareIntent();
    clearPendingShares();
    setNativeShareData(null);

    const params = [];
    if (imageUri) {
      params.push(`sharedImage=${encodeURIComponent(imageUri)}`);
    }
    if (sharedText) {
      params.push(`sharedText=${encodeURIComponent(sharedText)}`);
    }
    params.push(`shareTs=${Date.now()}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    router.replace(`/project/${project.id}${query}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <IconButton icon="close" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Share Receipt</Text>
          <Text style={styles.headerSubtitle}>Select a project</Text>
        </View>
      </Animated.View>

      {/* Shared Image / Text Preview */}
      {imageUri && !isCopying && !imageLoadError && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" onError={() => setImageLoadError(true)} />
          <View style={styles.previewInfo}>
            <IconButton icon="image" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.previewText} numberOfLines={1}>Receipt image attached</Text>
          </View>
        </Animated.View>
      )}
      {imageUri && imageLoadError && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.imagePreview, styles.errorPreview]}>
          <IconButton icon="alert-circle-outline" iconColor={theme.colors.expense} size={22} style={{ margin: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewText, { color: theme.colors.expense }]}>
              Could not display receipt preview. The file may be corrupted.
            </Text>
            <Pressable onPress={handleRefreshShare}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
      {isCopying && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.imagePreview, styles.copyingPreview]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.previewText, { marginTop: 8 }]}>Saving receipt preview…</Text>
        </Animated.View>
      )}
      {(copyError || shareError) && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.imagePreview, styles.errorPreview]}>
          <IconButton icon="alert-circle-outline" iconColor={theme.colors.expense} size={22} style={{ margin: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewText, { color: theme.colors.expense }]}>
              Could not read shared image: {copyError || shareError}
            </Text>
            <Pressable onPress={handleRefreshShare}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
      {hasShareIntent && !imageUri && !sharedText && !isCopying && !copyError && !nativeShareData && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.imagePreview, styles.errorPreview]}>
          <IconButton icon="alert-circle-outline" iconColor={theme.colors.expense} size={22} style={{ margin: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewText, { color: theme.colors.expense }]}>
              Share intent received, but no image or text was found.
            </Text>
            <Pressable onPress={handleRefreshShare}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
      {!imageUri && sharedText && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.imagePreview}>
          <View style={styles.previewInfo}>
            <IconButton icon="text-box-outline" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.previewText} numberOfLines={2}>{sharedText}</Text>
          </View>
        </Animated.View>
      )}

      {/* Always-visible diagnostics */}
      <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.imagePreview, styles.debugPreview]}>
        <Pressable onPress={() => setShowDebug(!showDebug)} style={styles.debugButton}>
          <IconButton icon="bug-outline" iconColor={theme.colors.secondary} size={18} style={{ margin: 0 }} />
          <Text style={styles.debugButtonText}>{showDebug ? 'Hide share details' : 'Tap for share details'}</Text>
        </Pressable>
        {showDebug && (
          <Text style={styles.debugText} selectable>
            {JSON.stringify({
              hasShareIntent,
              shareIntent,
              shareError,
              sharedImageUri,
              normalizedImageUri: imageUri,
              sharedText,
              rawFile,
              nativeShareData,
            }, null, 2)}
          </Text>
        )}
      </Animated.View>

      {/* Project List */}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ProjectCard project={item} index={index} onPress={canSelectProject ? handleSelectProject : null} />
        )}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(300).duration(800)} style={styles.emptyState}>
            <IconButton icon="folder-plus-outline" iconColor={theme.colors.primary} size={40} style={{ margin: 0 }} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>Create a project first, then share receipts to it.</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  closeButton: {
    borderRadius: 20,
    marginRight: 8,
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
  imagePreview: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 140,
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  copyingPreview: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  debugPreview: {
    padding: 12,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debugButtonText: {
    fontSize: 13,
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  debugText: {
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 10,
  },
  previewText: {
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
    flex: 1,
  },
  retryText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 6,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
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
    paddingTop: 120,
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
  retryButton: {
    marginTop: 18,
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});
