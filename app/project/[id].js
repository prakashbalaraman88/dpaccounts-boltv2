import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
  Keyboard,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput, IconButton, Portal, Modal, Chip } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { theme, formatRupees, CATEGORIES } from '../../src/constants/theme';
import { formatTime } from '../../src/utils/datetime';
import { prepareReceiptImage } from '../../src/utils/images';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../../src/utils/haptics';
import { useAppStore } from '../../src/stores/appStore';
import { analyzeMessage } from '../../src/services/ai';
import { uploadReceiptImage } from '../../src/services/supabase';

// Animated action button - uses Animated.View + Pressable
function ActionButton({ icon, onPress, color, size = 22, style, haptic = true }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (haptic) impactLight();
    onPress?.();
  };

  return (
    <Animated.View style={[animStyle]}>
      <Pressable
        style={[styles.actionButton, style]}
        onPressIn={() => { scale.value = withSpring(0.88, { damping: 12, stiffness: 200 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
        onPress={handlePress}
      >
        <IconButton icon={icon} iconColor={color || theme.colors.onSurfaceVariant} size={size} style={{ margin: 0 }} />
      </Pressable>
    </Animated.View>
  );
}

// Category item with press animation - uses Animated.View + Pressable
function CategoryItem({ category, onPress }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    impactLight();
    onPress?.(category);
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.categoryItem}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 200 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
      onPress={handlePress}
    >
      <View style={styles.categoryIconWrap}>
        <IconButton icon={category.icon} iconColor={theme.colors.primary} size={20} style={{ margin: 0 }} />
      </View>
      <Text style={styles.categoryLabel}>{category.label}</Text>
      <IconButton icon="chevron-right" iconColor={theme.colors.secondary} size={18} style={{ margin: 0 }} />
    </Pressable>
    </Animated.View>
  );
}

export default function ProjectChat() {
  const { id, sharedImage, sharedText } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const projectId = parseInt(id);
  const flatListRef = useRef(null);

  const {
    currentProject,
    messages,
    loadProject,
    addMessage,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateProject,
    deleteProject,
    updateMessageImage,
    aiApiKey,
  } = useAppStore();

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Transaction editor (tap a transaction badge to fix amount/type/category)
  const [editTxn, setEditTxn] = useState(null);
  const [editTxnType, setEditTxnType] = useState('expense');
  const [editTxnAmount, setEditTxnAmount] = useState('');
  const [editTxnVendor, setEditTxnVendor] = useState('');
  const [confirmTxnDelete, setConfirmTxnDelete] = useState(false);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);

  // Listen for keyboard to adjust edit modal height on Android
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

  // Send button animation
  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      loadProject(projectId);
    }, [projectId])
  );

  // Chat renders as an INVERTED list (newest at the bottom, like WhatsApp):
  // no scrollToEnd hacks, and FlatList virtualization starts from the
  // latest messages instead of cutting the chat off after 10 rows.
  const chatData = useMemo(() => [...messages].reverse(), [messages]);

  // Keep the chat pinned to the latest user message so the user sees their
  // own sends and the AI reply without manual scrolling.
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender === 'user') {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  }, [messages.length]);

  // Track which sharedImage/sharedText params we have already processed so
  // re-renders and navigation back-and-forth do not re-trigger the pipeline,
  // while still allowing a brand-new share (different param value) to run.
  const lastSharedImage = useRef(null);
  const lastSharedText = useRef(null);

  // Auto-process shared image from share intent.
  // Fully fenced: in release builds an unhandled rejection here kills the
  // whole app, so every step is caught and surfaced as a chat message.
  useEffect(() => {
    if (!sharedImage || !currentProject || isSending) return;
    if (lastSharedImage.current === sharedImage) return;
    lastSharedImage.current = sharedImage;

    setIsSending(true);
    (async () => {
      try {
        let imageUri;
        try {
          imageUri = decodeURIComponent(String(sharedImage));
        } catch {
          imageUri = String(sharedImage);
        }
        if (imageUri.startsWith('/')) {
          imageUri = 'file://' + imageUri;
        }

        // content:// URIs (Android share) → copy into our cache first
        let readPath = imageUri;
        if (imageUri.startsWith('content://')) {
          const cachePath = FileSystem.cacheDirectory + 'shared_receipt_' + Date.now() + '.jpg';
          await FileSystem.copyAsync({ from: imageUri, to: cachePath });
          const info = await FileSystem.getInfoAsync(cachePath);
          if (!info.exists || info.size === 0) {
            throw new Error('Shared image could not be copied from the originating app. Try sharing again or pick from gallery.');
          }
          readPath = cachePath;
        }

        // Downscale to a small JPEG — full-size screenshots OOM-crash
        // mid-range phones when base64'd
        const prepared = await prepareReceiptImage(readPath);
        if (!prepared.dataUri) {
          throw new Error('Could not read the shared image. It may be corrupted or no longer accessible.');
        }
        const analysisUri = prepared.dataUri;

        // Upload runs CONCURRENTLY with the AI call — its URL is only
        // needed when the user saves the category, seconds from now.
        const uploadPromise = storeReceipt(analysisUri);
        const messageId = await addMessage(projectId, 'image', 'Shared receipt image', prepared.uri, 'user');
        uploadPromise
          .then((url) => { if (url && url !== prepared.uri) updateMessageImage(messageId, projectId, url); })
          .catch(() => {});
        await processWithAI(
          'Analyze this image (receipt, bill, or payment-app screenshot) and extract the transaction details.',
          analysisUri,
          uploadPromise
        );
      } catch (e) {
        console.error('Shared image processing failed:', e);
        await addMessage(
          projectId, 'text',
          `Could not process the shared image (${e?.message || 'unknown error'}). Try picking it with the gallery button instead.`,
          null, 'system'
        ).catch(() => {});
      } finally {
        setIsSending(false);
      }
    })();
  }, [sharedImage, currentProject, isSending, projectId]);

  // Auto-process shared TEXT (GPay and many apps share text, not images)
  useEffect(() => {
    if (!sharedText || !currentProject || isSending) return;
    if (lastSharedText.current === sharedText) return;
    lastSharedText.current = sharedText;

    setIsSending(true);
    (async () => {
      try {
        let text;
        try {
          text = decodeURIComponent(String(sharedText));
        } catch {
          text = String(sharedText);
        }
        await addMessage(projectId, 'text', text, null, 'user');
        await processWithAI(text);
      } catch (e) {
        console.error('Shared text processing failed:', e);
        await addMessage(
          projectId, 'text',
          `Could not process the shared text (${e?.message || 'unknown error'}).`,
          null, 'system'
        ).catch(() => {});
      } finally {
        setIsSending(false);
      }
    })();
  }, [sharedText, currentProject, isSending, projectId]);

  // receiptUrl may be a string OR a pending upload Promise — it's resolved
  // at category-save time so the AI never waits on the upload.
  const AI_TIMEOUT_MS = 30000;
  const processWithAI = async (content, imageUri = null, receiptUrl = null) => {
    try {
      // analyzeMessage parses simple text locally and only needs the API
      // key for receipts and ambiguous phrasing. Add an outer timeout so a
      // stuck image fetch or slow model never leaves the UI in "Analyzing…".
      const result = await Promise.race([
        analyzeMessage(aiApiKey, content, imageUri),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timed out. Please try again.')), AI_TIMEOUT_MS)
        ),
      ]);

      if (result.isTransaction) {
        const vendorInfo = result.vendor ? `\nVendor: ${result.vendor}` : '';
        const botMessage = `Detected: ${result.type === 'incoming' ? 'Incoming' : 'Expense'} of ${formatRupees(result.amount)}${vendorInfo}\n${result.description ? result.description : ''}\n\nPlease select a category:`;
        await addMessage(projectId, 'text', botMessage, null, 'bot');

        setPendingTransaction({
          amount: result.amount,
          type: result.type,
          description: result.description || content,
          vendor: result.vendor || '',
          categoryHint: result.category_hint || null,
          receiptUri: receiptUrl || null,
        });
        setSelectedType(result.type);
        setShowCategoryModal(true);
      } else {
        await addMessage(projectId, 'text', result.reply || 'I couldn\'t detect a transaction. Try messages like "Received 1,00,000" or "Paid 50,000 to carpenter".', null, 'bot');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      const isTimeout = error?.message?.includes('timed out');
      const isNoKey = !aiApiKey;
      let errorText = 'AI analysis failed. Please check the OpenRouter API key in Settings or try again.';
      if (isNoKey) {
        errorText = 'Receipt image analysis needs an OpenRouter API key — ask your admin to set it in Settings.';
      } else if (isTimeout) {
        errorText = 'AI analysis timed out. The free-tier model may be busy — please try again in a moment.';
      }
      await addMessage(projectId, 'text', errorText, null, 'system');
    }
  };

  // Upload a receipt to Supabase Storage so every device can see it.
  // Falls back to the local URI if the upload fails (e.g. offline).
  const storeReceipt = async (imageUri) => {
    try {
      return await uploadReceiptImage(imageUri, projectId);
    } catch (e) {
      console.warn('Receipt upload failed, keeping local URI:', e.message);
      return imageUri && imageUri.startsWith('data:') ? null : imageUri;
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    impactMedium();
    sendScale.value = withSpring(0.7, { damping: 8 });
    setTimeout(() => { sendScale.value = withSpring(1, { damping: 8 }); }, 150);

    setInputText('');
    setIsSending(true);
    try {
      await addMessage(projectId, 'text', text, null, 'user');
      await processWithAI(text);
    } catch (e) {
      console.error('Send failed:', e);
    } finally {
      setIsSending(false);
    }
  };

  // Normalize a picked/captured URI. Some Android galleries return content://
  // URIs that expo-image-manipulator cannot always read directly, so we copy
  // them into our cache first (same strategy as the share-intent path).
  const normalizePickedUri = async (uri) => {
    if (!uri) throw new Error('No image selected');
    let normalized = uri;
    if (normalized.startsWith('/')) {
      normalized = 'file://' + normalized;
    }
    if (normalized.startsWith('content://')) {
      const cachePath = FileSystem.cacheDirectory + 'picked_receipt_' + Date.now() + '.jpg';
      await FileSystem.copyAsync({ from: normalized, to: cachePath });
      const info = await FileSystem.getInfoAsync(cachePath);
      if (!info.exists || info.size === 0) {
        throw new Error('Could not read the selected image from the gallery.');
      }
      normalized = cachePath;
    }
    return normalized;
  };

  // Shared pipeline for picked/captured images: copy → downscale → upload ∥ analyze
  const processPickedImage = async (asset, label) => {
    if (!asset?.uri) {
      await addMessage(projectId, 'text', 'No image was selected. Please try again.', null, 'system').catch(() => {});
      return;
    }
    setIsSending(true);
    try {
      const normalizedUri = await normalizePickedUri(asset.uri);
      const prepared = await prepareReceiptImage(normalizedUri);
      if (!prepared.dataUri) {
        throw new Error('Could not prepare image for analysis');
      }
      const analysisUri = prepared.dataUri;
      const uploadPromise = storeReceipt(analysisUri);
      const messageId = await addMessage(projectId, 'image', label, prepared.uri, 'user');
      uploadPromise
        .then((url) => { if (url && url !== prepared.uri) updateMessageImage(messageId, projectId, url); })
        .catch(() => {});
      await processWithAI(
        'Analyze this image (receipt, bill, or payment-app screenshot) and extract the transaction details.',
        analysisUri,
        uploadPromise
      );
    } catch (e) {
      console.error('Image processing failed:', e);
      await addMessage(
        projectId, 'text',
        `Could not process the image (${e?.message || 'unknown error'}). Try again or type the details.`,
        null, 'system'
      ).catch(() => {});
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    impactLight();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        await addMessage(
          projectId, 'text',
          'Gallery permission is needed to attach receipt images. You can enable it in app settings.',
          null, 'system'
        ).catch(() => {});
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]) {
        await processPickedImage(result.assets[0], 'Receipt image');
      }
    } catch (e) {
      console.error('Gallery picker failed:', e);
      await addMessage(projectId, 'text', `Gallery picker failed: ${e?.message || 'unknown error'}`, null, 'system').catch(() => {});
    }
  };

  const handleCameraCapture = async () => {
    impactLight();
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        await addMessage(
          projectId, 'text',
          'Camera permission is needed to capture receipt photos. You can enable it in app settings.',
          null, 'system'
        ).catch(() => {});
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (!result.canceled && result.assets?.[0]) {
        await processPickedImage(result.assets[0], 'Receipt photo');
      }
    } catch (e) {
      console.error('Camera capture failed:', e);
      await addMessage(projectId, 'text', `Camera capture failed: ${e?.message || 'unknown error'}`, null, 'system').catch(() => {});
    }
  };

  const handleCategorySelect = async (category) => {
    if (!pendingTransaction || isSending) return;
    impactMedium();

    // The Incoming/Expense toggle is the user's correction of the AI's
    // detection — the ACTIVE TAB decides the saved type, not the original.
    const txType = selectedType || pendingTransaction.type;

    // The receipt upload ran in the background; resolve it now if pending
    let receiptUri = pendingTransaction.receiptUri || null;
    if (receiptUri && typeof receiptUri.then === 'function') {
      receiptUri = await receiptUri.catch(() => null);
    }

    const messageId = await addMessage(
      projectId,
      'text',
      `${txType === 'incoming' ? 'Incoming' : 'Expense'}: ${formatRupees(pendingTransaction.amount)}\nCategory: ${category.label}\n${pendingTransaction.description}`,
      null,
      'bot'
    );

    setIsSending(true);
    try {
      await addTransaction(
        projectId,
        messageId,
        txType,
        pendingTransaction.amount,
        category.id,
        category.label,
        pendingTransaction.description,
        {
          vendor: pendingTransaction.vendor || '',
          receiptUri,
        }
      );
      notificationSuccess();
    } catch (e) {
      console.error('Save transaction failed:', e);
      notificationError();
      await addMessage(
        projectId, 'text',
        `Could not save transaction: ${e?.message || 'unknown error'}. Tap the amount to retry.`,
        null, 'system'
      ).catch(() => {});
    } finally {
      setIsSending(false);
    }

    setPendingTransaction(null);
    setShowCategoryModal(false);
    setSelectedType(null);
  };

  // ---- Transaction editor (fix wrong type/amount/category, or delete) ----

  const openTxnEditor = (item) => {
    setEditTxn({ id: item.transaction_id });
    setEditTxnType(item.transaction_type || 'expense');
    setEditTxnAmount(item.amount != null ? String(item.amount) : '');
    setEditTxnVendor(item.vendor || '');
    setConfirmTxnDelete(false);
  };

  const handleTxnEditSave = async (category) => {
    if (!editTxn) return;
    const amount = parseFloat(editTxnAmount);
    if (!isFinite(amount) || amount <= 0) return;
    impactLight();
    try {
      await updateTransaction(editTxn.id, projectId, {
        type: editTxnType,
        amount,
        category_id: category.id,
        category_label: category.label,
        vendor: editTxnVendor.trim(),
      });
      notificationSuccess();
      setEditTxn(null);
    } catch (e) {
      notificationError();
      console.error('Update transaction failed:', e);
    }
  };

  const handleTxnDelete = async () => {
    if (!confirmTxnDelete) {
      setConfirmTxnDelete(true);
      return;
    }
    impactHeavy();
    try {
      await deleteTransaction(editTxn.id, projectId);
      setEditTxn(null);
    } catch (e) {
      notificationError();
      console.error('Delete transaction failed:', e);
    }
  };

  const handleProjectDelete = async () => {
    if (!confirmProjectDelete) {
      setConfirmProjectDelete(true);
      return;
    }
    impactHeavy();
    try {
      await deleteProject(projectId);
      setShowEditModal(false);
      router.replace('/');
    } catch (e) {
      notificationError();
      console.error('Delete project failed:', e);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
    const isSystem = item.sender === 'system';

    // Plain Views: entering animations fight the inverted list's scaleY(-1)
    // cell transform (flipped/flickering bubbles, endless repaints).
    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View
        style={[styles.messageBubbleWrapper, isUser ? styles.sentWrapper : styles.receivedWrapper]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.sentBubble : styles.receivedBubble,
            item.transaction_id && styles.transactionBubble,
          ]}
        >
          {item.type === 'image' && item.image_uri && (
            <Image source={{ uri: item.image_uri }} style={styles.messageImage} resizeMode="cover" />
          )}
          <Text style={[styles.messageText, isUser && styles.sentText]}>{item.content}</Text>
          {item.transaction_id && (
            <Pressable
              onPress={() => openTxnEditor(item)}
              style={[
                styles.transactionBadge,
                {
                  backgroundColor:
                    item.transaction_type === 'incoming'
                      ? theme.colors.incomingMuted
                      : theme.colors.expenseMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.transactionBadgeText,
                  {
                    color:
                      item.transaction_type === 'incoming'
                        ? theme.colors.incoming
                        : theme.colors.expense,
                  },
                ]}
              >
                {item.transaction_type === 'incoming' ? '↓' : '↑'} {formatRupees(item.amount)} {'\u2022'} {item.category_label}
              </Text>
            </Pressable>
          )}
          <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const balance = currentProject ? currentProject.total_incoming - currentProject.total_expense : 0;

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // SDK 55 is edge-to-edge: the window never resizes for the keyboard
      // (adjustResize is gone), so KAV padding must make room on Android too.
      behavior="padding"
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }]}>
        <ActionButton
          icon="arrow-left"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          color={theme.colors.onSurface}
        />
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {getInitials(currentProject?.client_name)}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {currentProject?.client_name || 'Loading...'}
          </Text>
          <Text style={styles.headerProject} numberOfLines={1}>
            {currentProject?.project_name || ''}
          </Text>
        </View>
        <ActionButton
          icon="pencil-outline"
          onPress={() => {
            setEditClientName(currentProject?.client_name || '');
            setEditProjectName(currentProject?.project_name || '');
            setEditBudget(currentProject?.budget ? String(currentProject.budget) : '');
            setShowEditModal(true);
          }}
          color={theme.colors.secondary}
          size={18}
        />
        <View style={styles.headerBalance}>
          <Text style={styles.headerBalanceLabel}>BALANCE</Text>
          <Text
            style={[
              styles.headerBalanceAmount,
              { color: balance >= 0 ? theme.colors.incoming : theme.colors.expense },
            ]}
          >
            {formatRupees(Math.abs(balance))}
          </Text>
        </View>
      </Animated.View>

      {/* Summary Bar */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: theme.colors.incoming }]} />
          <View>
            <Text style={styles.summaryLabel}>Incoming</Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.incoming }]}>
              {formatRupees(currentProject?.total_incoming || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: theme.colors.expense }]} />
          <View>
            <Text style={styles.summaryLabel}>Expense</Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.expense }]}>
              {formatRupees(currentProject?.total_expense || 0)}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={chatData}
        inverted={messages.length > 0}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        style={styles.chatArea}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Animated.View entering={FadeIn.delay(300).duration(800)} style={styles.emptyChat}>
            <View style={styles.emptyChatIconContainer}>
              <IconButton icon="message-text-outline" iconColor={theme.colors.primary} size={32} style={{ margin: 0 }} />
            </View>
            <Text style={styles.emptyChatTitle}>Start a conversation</Text>
            <Text style={styles.emptyChatSubtitle}>
              Send messages like "Received 1,00,000"{'\n'}or share receipt images
            </Text>
          </Animated.View>
        }
      />

      {/* Working indicator — instant feedback while the AI reads receipts */}
      {isSending && (
        <View style={styles.analyzingPill}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.analyzingText}>Analyzing…</Text>
        </View>
      )}

      {/* Input Bar */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.inputBar, { paddingBottom: Math.max(8, insets.bottom + 8) }]}>
        <View style={styles.inputActions}>
          <ActionButton icon="camera" onPress={handleCameraCapture} color={theme.colors.secondary} size={20} />
          <ActionButton icon="image" onPress={handlePickImage} color={theme.colors.secondary} size={20} />
        </View>
        <View style={styles.inputField}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder='Type a message...'
            placeholderTextColor={theme.colors.secondary}
            style={styles.textInput}
            mode="flat"
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            textColor={theme.colors.onSurface}
            // WhatsApp-style: input stays enabled while the AI works so the
            // keyboard never closes; multiline grows up to ~4 lines.
            multiline
            blurOnSubmit={false}
            onKeyPress={(e) => {
              const ne = e.nativeEvent || e;
              if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                e.preventDefault?.();
                handleSend();
              }
            }}
            theme={{ colors: { primary: 'transparent' } }}
          />
        </View>
        <Animated.View style={sendAnimStyle}>
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={isSending || !inputText.trim()}
          >
            <IconButton
              icon="send"
              iconColor={inputText.trim() && !isSending ? '#0A0A0A' : theme.colors.secondary}
              size={20}
              style={{ margin: 0 }}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* Category Selection Modal — conditionally mounted: Paper's web
          dismiss animation can leave a stuck empty modal otherwise */}
      <Portal>
        {showCategoryModal && (
        <Modal
          visible={showCategoryModal}
          onDismiss={() => {
            setShowCategoryModal(false);
            setPendingTransaction(null);
          }}
          contentContainerStyle={[styles.categoryModal, { paddingBottom: Math.max(36, insets.bottom + 20) }]}
          style={styles.categoryModalOverlay}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.categoryModalTitle}>Select Category</Text>
          {pendingTransaction && (
            <View
              style={[
                styles.transactionPreview,
                {
                  backgroundColor:
                    pendingTransaction.type === 'incoming'
                      ? theme.colors.incomingMuted
                      : theme.colors.expenseMuted,
                  borderColor:
                    pendingTransaction.type === 'incoming'
                      ? 'rgba(74,222,128,0.2)'
                      : 'rgba(251,113,133,0.2)',
                },
              ]}
            >
              <Text
                style={[
                  styles.transactionPreviewText,
                  {
                    color:
                      pendingTransaction.type === 'incoming'
                        ? theme.colors.incoming
                        : theme.colors.expense,
                  },
                ]}
              >
                {pendingTransaction.type === 'incoming' ? '↓ Incoming' : '↑ Expense'}:{' '}
                {formatRupees(pendingTransaction.amount)}
              </Text>
            </View>
          )}

          {/* Type toggle */}
          <View style={styles.typeToggle}>
            <Pressable
              style={[
                styles.typeTab,
                selectedType === 'incoming' && styles.typeTabActiveIncoming,
              ]}
              onPress={() => setSelectedType('incoming')}
            >
              <Text
                style={[
                  styles.typeTabText,
                  selectedType === 'incoming' && { color: theme.colors.incoming },
                ]}
              >
                Incoming
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.typeTab,
                selectedType === 'expense' && styles.typeTabActiveExpense,
              ]}
              onPress={() => setSelectedType('expense')}
            >
              <Text
                style={[
                  styles.typeTabText,
                  selectedType === 'expense' && { color: theme.colors.expense },
                ]}
              >
                Expense
              </Text>
            </Pressable>
          </View>

          {/* Category list */}
          <View style={styles.categoryList}>
            {selectedType &&
              CATEGORIES[selectedType].map((cat, index) => (
                <CategoryItem key={cat.id} category={cat} onPress={handleCategorySelect} />
              ))}
          </View>

          <Pressable
            style={styles.modalCancelButton}
            onPress={() => {
              setShowCategoryModal(false);
              setPendingTransaction(null);
            }}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </Modal>
        )}
      </Portal>
      {/* Edit Project Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => setShowEditModal(false)}
          contentContainerStyle={[
            styles.editModal,
            { paddingBottom: Math.max(36, insets.bottom + 20) },
            keyboardHeight > 0 && {
              marginBottom: keyboardHeight - insets.bottom,
              maxHeight: Dimensions.get('window').height - keyboardHeight - 80,
            },
          ]}
          style={styles.categoryModalOverlay}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <Text style={styles.categoryModalTitle}>Edit Project</Text>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>Client Name</Text>
              <TextInput
                value={editClientName}
                onChangeText={setEditClientName}
                style={styles.editInput}
                mode="outlined"
                placeholder="Client name"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>Project Name</Text>
              <TextInput
                value={editProjectName}
                onChangeText={setEditProjectName}
                style={styles.editInput}
                mode="outlined"
                placeholder="Project name"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>Budget</Text>
              <TextInput
                value={editBudget}
                onChangeText={setEditBudget}
                style={styles.editInput}
                mode="outlined"
                placeholder="0"
                placeholderTextColor={theme.colors.secondary}
                keyboardType="numeric"
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <Pressable
              style={styles.editSaveButton}
              onPress={async () => {
                if (!editClientName.trim() || !editProjectName.trim()) return;
                await updateProject(projectId, {
                  client_name: editClientName.trim(),
                  project_name: editProjectName.trim(),
                  budget: parseFloat(editBudget) || 0,
                });
                setShowEditModal(false);
              }}
            >
              <Text style={styles.editSaveText}>Save Changes</Text>
            </Pressable>

            <Pressable style={styles.dangerButton} onPress={handleProjectDelete}>
              <Text style={styles.dangerButtonText}>
                {confirmProjectDelete
                  ? 'Tap again to permanently delete'
                  : 'Delete Project'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setShowEditModal(false);
                setConfirmProjectDelete(false);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Transaction Editor Modal — tap a transaction badge to open */}
      <Portal>
        {!!editTxn && (
        <Modal
          visible={!!editTxn}
          onDismiss={() => setEditTxn(null)}
          contentContainerStyle={[styles.categoryModal, { paddingBottom: Math.max(36, insets.bottom + 20) }]}
          style={styles.categoryModalOverlay}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <Text style={styles.categoryModalTitle}>Edit Transaction</Text>

            <View style={styles.typeToggle}>
              <Pressable
                style={[styles.typeTab, editTxnType === 'incoming' && styles.typeTabActiveIncoming]}
                onPress={() => setEditTxnType('incoming')}
              >
                <Text style={[styles.typeTabText, editTxnType === 'incoming' && { color: theme.colors.incoming }]}>
                  Incoming
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeTab, editTxnType === 'expense' && styles.typeTabActiveExpense]}
                onPress={() => setEditTxnType('expense')}
              >
                <Text style={[styles.typeTabText, editTxnType === 'expense' && { color: theme.colors.expense }]}>
                  Expense
                </Text>
              </Pressable>
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>Amount (₹)</Text>
              <TextInput
                value={editTxnAmount}
                onChangeText={setEditTxnAmount}
                style={styles.editInput}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>Vendor (optional)</Text>
              <TextInput
                value={editTxnVendor}
                onChangeText={setEditTxnVendor}
                style={styles.editInput}
                mode="outlined"
                placeholder="Vendor / payee"
                placeholderTextColor={theme.colors.secondary}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                outlineStyle={{ borderRadius: 12 }}
                theme={{ roundness: 12 }}
              />
            </View>

            <Text style={[styles.editLabel, { marginTop: 4 }]}>Tap a category to save</Text>
            <View style={styles.categoryList}>
              {CATEGORIES[editTxnType].map((cat) => (
                <CategoryItem key={cat.id} category={cat} onPress={handleTxnEditSave} />
              ))}
            </View>

            <Pressable style={styles.dangerButton} onPress={handleTxnDelete}>
              <Text style={styles.dangerButtonText}>
                {confirmTxnDelete ? 'Tap again to confirm delete' : 'Delete Transaction'}
              </Text>
            </Pressable>

            <Pressable style={styles.modalCancelButton} onPress={() => setEditTxn(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Modal>
        )}
      </Portal>
    </KeyboardAvoidingView>
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
    paddingRight: 16,
    paddingLeft: 4,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  actionButton: {
    borderRadius: 20,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
  },
  headerProject: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
    marginTop: 1,
  },
  headerBalance: {
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    maxWidth: 110,
  },
  headerBalanceLabel: {
    fontSize: 9,
    color: theme.colors.secondary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerBalanceAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 10,
    color: theme.colors.secondary,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.outline,
    marginHorizontal: 16,
  },

  // Chat Area
  chatArea: {
    flex: 1,
    backgroundColor: theme.colors.chatBackground,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  messageBubbleWrapper: {
    marginVertical: 3,
    maxWidth: '82%',
  },
  sentWrapper: {
    alignSelf: 'flex-end',
  },
  receivedWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  sentBubble: {
    backgroundColor: theme.colors.chatBubbleSent,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.08)',
  },
  receivedBubble: {
    backgroundColor: theme.colors.chatBubbleReceived,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  transactionBubble: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.onSurface,
    lineHeight: 21,
  },
  sentText: {
    color: '#F0E6D8',
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageTime: {
    fontSize: 10,
    color: theme.colors.secondary,
    alignSelf: 'flex-end',
    marginTop: 4,
    fontWeight: '500',
  },
  transactionBadge: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  transactionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  systemText: {
    fontSize: 12,
    color: theme.colors.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyChatIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  analyzingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginLeft: 14,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  analyzingText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '600',
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    gap: 6,
  },
  inputActions: {
    flexDirection: 'row',
  },
  inputField: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  textInput: {
    backgroundColor: 'transparent',
    minHeight: 44,
    maxHeight: 110,
    fontSize: 14,
    paddingHorizontal: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.surfaceElevated,
  },

  // Category Modal
  categoryModalOverlay: {
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderBottomWidth: 0,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  categoryModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  transactionPreview: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  transactionPreviewText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  typeTabActiveIncoming: {
    backgroundColor: theme.colors.incomingMuted,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  typeTabActiveExpense: {
    backgroundColor: theme.colors.expenseMuted,
    borderColor: 'rgba(251,113,133,0.25)',
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.secondary,
  },
  categoryList: {
    gap: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 15,
    color: theme.colors.onSurface,
    flex: 1,
    fontWeight: '500',
  },
  modalCancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.secondary,
  },

  // Edit Project Modal
  editModal: {
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderBottomWidth: 0,
  },
  editField: {
    marginBottom: 14,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  editInput: {
    backgroundColor: theme.colors.surface,
    fontSize: 14,
  },
  editSaveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: 0.3,
  },
  dangerButton: {
    backgroundColor: theme.colors.expenseMuted,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.25)',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.expense,
    letterSpacing: 0.3,
  },
});
