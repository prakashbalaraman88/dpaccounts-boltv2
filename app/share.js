import { useEffect } from 'react';
import { View, FlatList, StyleSheet, Pressable, Image } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { theme, formatRupees } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';

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
        onPress={() => onPress(project)}
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
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { projects, loadProjects } = useAppStore();

  useEffect(() => {
    loadProjects();
  }, []);

  const sharedImageUri = shareIntent?.files?.[0]?.path || null;
  // GPay & co. often share plain text instead of an image
  const sharedText = !sharedImageUri
    ? shareIntent?.text || shareIntent?.webUrl || null
    : null;

  const handleClose = () => {
    resetShareIntent();
    router.replace('/');
  };

  // If no share data, show empty state
  if (!hasShareIntent && !sharedImageUri && !sharedText) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <IconButton icon="close" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Share Receipt</Text>
            <Text style={styles.headerSubtitle}>No image received</Text>
          </View>
        </Animated.View>
        <View style={styles.emptyState}>
          <IconButton icon="image-off-outline" iconColor={theme.colors.secondary} size={40} style={{ margin: 0 }} />
          <Text style={styles.emptyTitle}>No image shared</Text>
          <Text style={styles.emptySubtitle}>Share a receipt image from your gallery or camera to get started.</Text>
        </View>
      </View>
    );
  }

  const handleSelectProject = (project) => {
    // Reset BEFORE navigating: a lingering hasShareIntent makes the
    // _layout gate bounce the user back to this screen on re-renders.
    resetShareIntent();
    if (sharedImageUri) {
      router.replace(`/project/${project.id}?sharedImage=${encodeURIComponent(sharedImageUri)}`);
    } else if (sharedText) {
      router.replace(`/project/${project.id}?sharedText=${encodeURIComponent(sharedText)}`);
    } else {
      router.replace(`/project/${project.id}`);
    }
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
      {sharedImageUri && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.imagePreview}>
          <Image source={{ uri: sharedImageUri }} style={styles.previewImage} resizeMode="cover" />
          <View style={styles.previewInfo}>
            <IconButton icon="image" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.previewText} numberOfLines={1}>Receipt image attached</Text>
          </View>
        </Animated.View>
      )}
      {!sharedImageUri && sharedText && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.imagePreview}>
          <View style={styles.previewInfo}>
            <IconButton icon="text-box-outline" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.previewText} numberOfLines={2}>{sharedText}</Text>
          </View>
        </Animated.View>
      )}

      {/* Project List */}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ProjectCard project={item} index={index} onPress={handleSelectProject} />
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
  previewText: {
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
    flex: 1,
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
});
