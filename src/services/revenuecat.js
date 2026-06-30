/**
 * RevenueCat subscription service for Ledge.
 *
 * Three subscription tiers (monthly):
 *   Starter  — up to 10 projects  — entitlement: "starter"
 *   Pro      — up to 50 projects  — entitlement: "pro"
 *   Unlimited — unlimited projects — entitlement: "unlimited"
 *
 * Free tier: 1 project (no subscription required)
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

const CUSTOMER_INFO_CACHE_KEY = '@revenuecat_customer_info_cache';

// ── Env vars (set after running scripts/seedRevenueCat.ts) ────────────────────
const TEST_KEY    = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// ── Public constants ──────────────────────────────────────────────────────────
// Imported from a native-free module so unit tests can consume them without
// mocking react-native-purchases / expo-constants.
import { ENTITLEMENT, PLAN_LIMITS, PLAN_NAMES } from '../constants/planLimits';
export { ENTITLEMENT, PLAN_LIMITS, PLAN_NAMES };

// ── Pure plan-derivation helper ────────────────────────────────────────────────
// Lives in a native-free module so unit tests can exercise the same logic
// path without mocking react-native-purchases or expo-constants.
import { activePlanFromCustomerInfo } from '../utils/activePlan';
export { activePlanFromCustomerInfo };

/** Display info for each package key (matches seed script keys) */
export const TIER_INFO = {
  ledge_starter: {
    name:       'Starter',
    icon:       'folder-multiple-outline',
    limitText:  'Up to 10 projects',
    limit:      10,
    color:      '#4ADE80',
    priceLabel: '₹199',
    features:   ['Up to 10 projects', 'Transaction tracking', 'Receipt scanning', 'AI categorisation'],
  },
  ledge_pro: {
    name:       'Pro',
    icon:       'briefcase-outline',
    limitText:  'Up to 50 projects',
    limit:      50,
    color:      '#C9A87C',
    isPopular:  true,
    priceLabel: '₹399',
    features:   ['Up to 50 projects', 'Everything in Starter', 'Advanced analytics', 'Priority support'],
  },
  ledge_unlimited: {
    name:       'Unlimited',
    icon:       'infinity',
    limitText:  'Unlimited projects',
    limit:      Infinity,
    color:      '#8B73FD',
    priceLabel: '₹699',
    features:   ['Unlimited projects', 'Everything in Pro', 'Team access', 'Premium support'],
  },
};

/** Order in which tiers are displayed */
export const TIER_ORDER = ['ledge_starter', 'ledge_pro', 'ledge_unlimited'];

// ── Initialisation ────────────────────────────────────────────────────────────

let _initialized = false;

/**
 * Optional callback invoked with fresh CustomerInfo after a successful logIn().
 * The SubscriptionProvider registers this so it always reflects the identified
 * user's entitlements — even when the CustomerInfoUpdateListener is silent
 * (RC already had this user cached from a previous session / app restart).
 */
let _onPostLoginCustomerInfo = null;

export function setPostLoginCustomerInfoCallback(cb) {
  _onPostLoginCustomerInfo = cb;
}

/**
 * Associate the RevenueCat SDK with the authenticated user.
 * Call this immediately after login/session restore so that subscription
 * state is correctly attributed and Restore Purchases works cross-device.
 *
 * After logIn() succeeds, we always fetch fresh CustomerInfo and push it to
 * the SubscriptionProvider via _onPostLoginCustomerInfo. This covers the
 * app-restart path where the listener may not fire because the user identity
 * is unchanged in RC's local state.
 */
export async function identifyRevenueCatUser(userId) {
  if (!_initialized || !userId) return;
  try {
    await Purchases.logIn(userId);
    console.log('[RevenueCat] User identified:', userId);
    const info = await Purchases.getCustomerInfo();
    if (_onPostLoginCustomerInfo) _onPostLoginCustomerInfo(info);
  } catch (e) {
    console.error('[RevenueCat] Failed to identify user:', e);
  }
}

/**
 * Reset the RevenueCat SDK to an anonymous user on logout.
 * Call this when the user signs out.
 */
export async function logoutRevenueCatUser() {
  if (!_initialized) return;
  try {
    await Purchases.logOut();
    console.log('[RevenueCat] User logged out.');
  } catch (e) {
    console.warn('[RevenueCat] Logout error (non-fatal):', e);
  }
}

function getApiKey() {
  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return TEST_KEY;
  }
  if (Platform.OS === 'ios')     return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return TEST_KEY;
}

/**
 * Initialise RevenueCat. Returns true on success, false if API key is missing.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initializeRevenueCat() {
  if (_initialized) return true;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] API key not found — subscription features unavailable until env vars are set.');
    return false;
  }
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  _initialized = true;
  console.log('[RevenueCat] Initialized.');
  return true;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext(null);

function useSubscriptionContext() {
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings]       = useState(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring]   = useState(false);
  const [revCatReady, setRevCatReady]   = useState(_initialized);

  const persistCustomerInfo = useCallback(async (info) => {
    if (!info) return;
    try {
      await AsyncStorage.setItem(CUSTOMER_INFO_CACHE_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('[RevenueCat] Failed to persist customerInfo cache:', e);
    }
  }, []);

  const setAndPersistCustomerInfo = useCallback((info) => {
    setCustomerInfo(info);
    persistCustomerInfo(info);
  }, [persistCustomerInfo]);

  const loadData = useCallback(async () => {
    if (!_initialized) {
      setIsLoading(false);
      return null;
    }
    setIsLoading(true);
    try {
      const [info, offers] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setAndPersistCustomerInfo(info);
      setOfferings(offers);
      return info;
    } catch (e) {
      console.error('[RevenueCat] Failed to load data:', e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setAndPersistCustomerInfo]);

  useEffect(() => {
    if (!_initialized) {
      setIsLoading(false);
      return;
    }
    setRevCatReady(true);

    // Hydrate from cache immediately so plan-gated UI shows the correct tier
    // before the network call resolves.
    AsyncStorage.getItem(CUSTOMER_INFO_CACHE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setCustomerInfo(JSON.parse(raw));
          } catch {
            // Ignore malformed cache
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        // Always fire the live network fetch regardless of cache outcome.
        loadData();
      });

    setPostLoginCustomerInfoCallback((info) => {
      setAndPersistCustomerInfo(info);
    });

    let unsub = null;
    try {
      unsub = Purchases.addCustomerInfoUpdateListener((info) => {
        setAndPersistCustomerInfo(info);
      });
    } catch {
      // Listener API may not be available on all platforms/versions
    }
    return () => {
      setPostLoginCustomerInfoCallback(null);
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // ── Derive active plan ─────────────────────────────────────────────────────
  // Uses the shared pure helper so unit tests cover the exact same code path.
  const activePlan = activePlanFromCustomerInfo(customerInfo);

  const projectLimit = PLAN_LIMITS[activePlan];

  // ── Lightweight customer-info-only refresh (used by post-purchase polling) ─
  // Does NOT touch isLoading or offerings so the "Syncing…" banner stays visible
  // and the offerings UI is not disrupted.
  const refreshCustomerInfo = useCallback(async () => {
    if (!_initialized) return null;
    try {
      const info = await Purchases.getCustomerInfo();
      setAndPersistCustomerInfo(info);
      return info;
    } catch (e) {
      console.warn('[RevenueCat] refreshCustomerInfo failed:', e);
      return null;
    }
  }, [setAndPersistCustomerInfo]);

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchase = useCallback(async (pkg) => {
    setIsPurchasing(true);
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setAndPersistCustomerInfo(info);
      return info;
    } finally {
      setIsPurchasing(false);
    }
  }, [setAndPersistCustomerInfo]);

  // ── Restore ────────────────────────────────────────────────────────────────
  const restore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      setAndPersistCustomerInfo(info);
      return info;
    } finally {
      setIsRestoring(false);
    }
  }, [setAndPersistCustomerInfo]);

  return {
    customerInfo,
    offerings,
    isLoading,
    isPurchasing,
    isRestoring,
    revCatReady,
    activePlan,
    projectLimit,
    purchase,
    restore,
    refresh: loadData,
    refreshCustomerInfo,
  };
}

export function SubscriptionProvider({ children }) {
  const value = useSubscriptionContext();
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
