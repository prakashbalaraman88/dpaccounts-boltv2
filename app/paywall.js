import { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { Text, IconButton, ActivityIndicator } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/constants/theme';
import { useSubscription, TIER_INFO, TIER_ORDER } from '../src/services/revenuecat';
import { impactLight, impactMedium } from '../src/utils/haptics';

function PlanBadge({ label }) {
  return (
    <View style={styles.popularBadge}>
      <Text style={styles.popularBadgeText}>{label}</Text>
    </View>
  );
}

function TierCard({ pkg, tierInfo, isSelected, onSelect }) {
  const priceString = pkg?.product?.priceString ?? '—';
  const isPopular   = tierInfo?.isPopular ?? false;

  return (
    <Pressable
      style={[
        styles.tierCard,
        isSelected && { borderColor: tierInfo?.color ?? theme.colors.accent, borderWidth: 2 },
      ]}
      onPress={() => { impactLight(); onSelect(); }}
    >
      {isPopular && <PlanBadge label="MOST POPULAR" />}

      <View style={styles.tierCardTop}>
        <View style={[styles.tierIconWrap, { backgroundColor: `${tierInfo?.color ?? theme.colors.accent}18` }]}>
          <IconButton
            icon={tierInfo?.icon ?? 'star-outline'}
            iconColor={tierInfo?.color ?? theme.colors.accent}
            size={22}
            style={{ margin: 0 }}
          />
        </View>
        <View style={styles.tierCardInfo}>
          <Text style={styles.tierName}>{tierInfo?.name ?? pkg?.identifier}</Text>
          <Text style={styles.tierLimit}>{tierInfo?.limitText ?? '—'}</Text>
        </View>
        <View style={styles.tierPriceWrap}>
          <Text style={[styles.tierPrice, { color: tierInfo?.color ?? theme.colors.accent }]}>
            {priceString}
          </Text>
          <Text style={styles.tierPricePer}>/mo</Text>
        </View>
      </View>

      <View style={styles.tierFeatures}>
        {(tierInfo?.features ?? []).map((f) => (
          <View key={f} style={styles.tierFeatureRow}>
            <IconButton icon="check-circle" iconColor={tierInfo?.color ?? theme.colors.incoming} size={14} style={{ margin: 0 }} />
            <Text style={styles.tierFeatureText}>{f}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function ConfirmModal({ visible, pkg, tierInfo, onConfirm, onCancel, isPurchasing }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmSheet}>
          <View style={styles.confirmHandle} />

          <View style={[styles.confirmIconWrap, { backgroundColor: `${tierInfo?.color ?? theme.colors.accent}18` }]}>
            <IconButton
              icon={tierInfo?.icon ?? 'star-outline'}
              iconColor={tierInfo?.color ?? theme.colors.accent}
              size={28}
              style={{ margin: 0 }}
            />
          </View>

          <Text style={styles.confirmTitle}>Subscribe to {tierInfo?.name}?</Text>
          <Text style={styles.confirmDesc}>
            {tierInfo?.limitText} · {pkg?.product?.priceString ?? '—'}/month{'\n'}
            You can cancel anytime from your device settings.
          </Text>

          {isPurchasing ? (
            <ActivityIndicator size="small" color={tierInfo?.color ?? theme.colors.accent} style={{ marginVertical: 16 }} />
          ) : (
            <>
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: tierInfo?.color ?? theme.colors.accent }]}
                onPress={onConfirm}
              >
                <Text style={styles.confirmBtnText}>Subscribe Now</Text>
              </Pressable>
              <Pressable style={styles.confirmCancelBtn} onPress={onCancel}>
                <Text style={styles.confirmCancelText}>Not Now</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function PaywallScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const {
    offerings,
    isLoading,
    isPurchasing,
    isRestoring,
    activePlan,
    projectLimit,
    purchase,
    restore,
  } = useSubscription();

  const [selectedPkg, setSelectedPkg] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [successMsg, setSuccessMsg]   = useState('');

  // Sort packages in tier order
  const sortedPackages = useMemo(() => {
    if (!offerings?.current?.availablePackages) return [];
    const pkgs = offerings.current.availablePackages;
    return TIER_ORDER
      .map((key) => pkgs.find((p) => p.identifier === key))
      .filter(Boolean);
  }, [offerings]);

  const handleSelectTier = (pkg) => {
    setSelectedPkg(pkg);
    setShowConfirm(true);
    setErrorMsg('');
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPkg) return;
    setErrorMsg('');
    try {
      await purchase(selectedPkg);
      setShowConfirm(false);
      setSuccessMsg(`Welcome to ${TIER_INFO[selectedPkg.identifier]?.name ?? 'Ledge Pro'}! 🎉`);
      setTimeout(() => {
        router.canGoBack() ? router.back() : router.replace('/');
      }, 1800);
    } catch (e) {
      setShowConfirm(false);
      const msg = e?.message ?? String(e);
      if (e?.userCancelled === true || /cancel/i.test(msg)) {
        // User cancelled — silent
      } else {
        setErrorMsg('Purchase failed. Please try again.');
      }
    }
  };

  const handleRestore = async () => {
    setErrorMsg('');
    try {
      const info = await restore();
      const active = info?.entitlements?.active ?? {};
      const hasSub = Object.keys(active).length > 0;
      if (hasSub) {
        setSuccessMsg('Purchases restored!');
        setTimeout(() => {
          router.canGoBack() ? router.back() : router.replace('/');
        }, 1500);
      } else {
        setErrorMsg('No previous purchases found for this account.');
      }
    } catch (e) {
      setErrorMsg('Restore failed. Please try again.');
    }
  };

  const handleManageSubscription = () => {
    const url = Platform.OS === 'android'
      ? 'https://play.google.com/store/account/subscriptions'
      : 'itms-apps://apps.apple.com/account/subscriptions';
    Linking.openURL(url).catch(() =>
      Linking.openURL('https://support.apple.com/en-us/HT202039')
    );
  };

  const selectedTierInfo = selectedPkg ? TIER_INFO[selectedPkg.identifier] : null;

  return (
    <View style={[styles.container, { paddingTop: Math.max(0, insets.top) }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
        >
          <IconButton icon="close" iconColor={theme.colors.onSurface} size={22} style={{ margin: 0 }} />
        </Pressable>
        <Text style={styles.headerTitle}>Choose a Plan</Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(32, insets.bottom + 16) }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <IconButton icon="crown-outline" iconColor={theme.colors.accent} size={32} style={{ margin: 0 }} />
          </View>
          <Text style={styles.heroTitle}>Unlock More Projects</Text>
          <Text style={styles.heroSub}>
            Free plan includes 1 project.{'\n'}
            Upgrade to track more clients and grow your business.
          </Text>
        </Animated.View>

        {/* Current plan pill */}
        {activePlan !== 'free' && (
          <Animated.View entering={FadeIn.delay(100)} style={styles.currentPlanRow}>
            <View style={styles.currentPlanPill}>
              <IconButton icon="check-circle" iconColor={theme.colors.incoming} size={16} style={{ margin: 0 }} />
              <Text style={styles.currentPlanText}>
                You're on the {activePlan.charAt(0).toUpperCase() + activePlan.slice(1)} plan — {projectLimit} projects
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Error / Success banner */}
        {(errorMsg || successMsg) && (
          <View style={[
            styles.banner,
            errorMsg ? styles.bannerError : styles.bannerSuccess,
          ]}>
            <Text style={[styles.bannerText, errorMsg ? styles.bannerTextError : styles.bannerTextSuccess]}>
              {errorMsg || successMsg}
            </Text>
          </View>
        )}

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading plans…</Text>
          </View>
        )}

        {/* No offerings (env vars not set yet) */}
        {!isLoading && sortedPackages.length === 0 && (
          <View style={styles.noOfferings}>
            <IconButton icon="cloud-off-outline" iconColor={theme.colors.secondary} size={32} style={{ margin: 0 }} />
            <Text style={styles.noOfferingsTitle}>Plans Unavailable</Text>
            <Text style={styles.noOfferingsText}>
              Subscription plans are still being configured.{'\n'}Please check back soon.
            </Text>
          </View>
        )}

        {/* Tier cards */}
        {!isLoading && sortedPackages.map((pkg, i) => (
          <Animated.View key={pkg.identifier} entering={FadeInDown.delay(160 + i * 80).duration(280)}>
            <TierCard
              pkg={pkg}
              tierInfo={TIER_INFO[pkg.identifier]}
              isSelected={false}
              onSelect={() => handleSelectTier(pkg)}
            />
          </Animated.View>
        ))}

        {/* Manage subscription (for existing subscribers) */}
        {activePlan !== 'free' && (
          <Animated.View entering={FadeIn.delay(500)}>
            <Pressable style={styles.manageBtn} onPress={handleManageSubscription}>
              <IconButton icon="cog-outline" iconColor={theme.colors.secondary} size={16} style={{ margin: 0 }} />
              <Text style={styles.manageBtnText}>Manage Subscription</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Restore purchases */}
        <Animated.View entering={FadeIn.delay(600)}>
          <Pressable
            style={[styles.restoreBtn, isRestoring && { opacity: 0.5 }]}
            onPress={handleRestore}
            disabled={isRestoring || isLoading}
          >
            {isRestoring
              ? <ActivityIndicator size="small" color={theme.colors.secondary} />
              : <Text style={styles.restoreBtnText}>Restore Purchases</Text>
            }
          </Pressable>
        </Animated.View>

        <Text style={styles.legalText}>
          Subscriptions renew monthly. Cancel anytime in your device's subscription settings. Prices shown in your local currency.
        </Text>
      </ScrollView>

      {/* Confirmation modal */}
      <ConfirmModal
        visible={showConfirm}
        pkg={selectedPkg}
        tierInfo={selectedTierInfo}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setShowConfirm(false)}
        isPurchasing={isPurchasing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: 0.3,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: theme.colors.accentContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Current plan pill ─────────────────────────────────────────────────────
  currentPlanRow: {
    alignItems: 'center',
  },
  currentPlanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.incomingMuted,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  currentPlanText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.incoming,
  },

  // ── Banners ───────────────────────────────────────────────────────────────
  banner: {
    borderRadius: 12,
    padding: 12,
  },
  bannerError: { backgroundColor: theme.colors.expenseMuted },
  bannerSuccess: { backgroundColor: theme.colors.incomingMuted },
  bannerText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  bannerTextError: { color: theme.colors.expense },
  bannerTextSuccess: { color: theme.colors.incoming },

  // ── Loading / no offerings ────────────────────────────────────────────────
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: theme.colors.secondary },
  noOfferings: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  noOfferingsTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  noOfferingsText: { fontSize: 13, color: theme.colors.secondary, textAlign: 'center', lineHeight: 20 },

  // ── Tier card ─────────────────────────────────────────────────────────────
  tierCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 17,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#080808',
    letterSpacing: 1,
  },
  tierCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  tierIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tierCardInfo: { flex: 1 },
  tierName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  tierLimit: {
    fontSize: 12,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  tierPriceWrap: { alignItems: 'flex-end' },
  tierPrice: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tierPricePer: {
    fontSize: 11,
    color: theme.colors.secondary,
    fontWeight: '500',
    marginTop: -2,
  },
  tierFeatures: { gap: 4 },
  tierFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tierFeatureText: {
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
  },

  // ── Manage / Restore ──────────────────────────────────────────────────────
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  manageBtnText: {
    fontSize: 13,
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  restoreBtnText: {
    fontSize: 14,
    color: theme.colors.secondary,
    fontWeight: '600',
  },

  // ── Legal ─────────────────────────────────────────────────────────────────
  legalText: {
    fontSize: 11,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },

  // ── Confirm modal ─────────────────────────────────────────────────────────
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderBottomWidth: 0,
  },
  confirmHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 22,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmDesc: {
    fontSize: 14,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  confirmBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080808',
  },
  confirmCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  confirmCancelText: {
    fontSize: 14,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
});
