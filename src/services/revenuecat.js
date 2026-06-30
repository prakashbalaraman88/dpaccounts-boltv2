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
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

// ── Env vars (set after running scripts/seedRevenueCat.ts) ────────────────────
const TEST_KEY    = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// ── Public constants ──────────────────────────────────────────────────────────

export const ENTITLEMENT = {
  STARTER:   'starter',
  PRO:       'pro',
  UNLIMITED: 'unlimited',
};

/** Project limit per plan */
export const PLAN_LIMITS = {
  free:      1,
  starter:   10,
  pro:       50,
  unlimited: Infinity,
};

/** Human-readable plan names */
export const PLAN_NAMES = {
  free:      'Free',
  starter:   'Starter',
  pro:       'Pro',
  unlimited: 'Unlimited',
};

/** Display info for each package key (matches seed script keys) */
export const TIER_INFO = {
  ledge_starter: {
    name:      'Starter',
    icon:      'folder-multiple-outline',
    limitText: 'Up to 10 projects',
    limit:     10,
    color:     '#4ADE80',
    features:  ['Up to 10 projects', 'Transaction tracking', 'Receipt scanning', 'AI categorisation'],
  },
  ledge_pro: {
    name:      'Pro',
    icon:      'briefcase-outline',
    limitText: 'Up to 50 projects',
    limit:     50,
    color:     '#C9A87C',
    isPopular: true,
    features:  ['Up to 50 projects', 'Everything in Starter', 'Advanced analytics', 'Priority support'],
  },
  ledge_unlimited: {
    name:      'Unlimited',
    icon:      'infinity',
    limitText: 'Unlimited projects',
    limit:     Infinity,
    color:     '#8B73FD',
    features:  ['Unlimited projects', 'Everything in Pro', 'Team access', 'Premium support'],
  },
};

/** Order in which tiers are displayed */
export const TIER_ORDER = ['ledge_starter', 'ledge_pro', 'ledge_unlimited'];

// ── Initialisation ────────────────────────────────────────────────────────────

let _initialized = false;

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

  const loadData = useCallback(async () => {
    if (!_initialized) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [info, offers] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setOfferings(offers);
    } catch (e) {
      console.error('[RevenueCat] Failed to load data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!_initialized) {
      setIsLoading(false);
      return;
    }
    setRevCatReady(true);
    loadData();

    let unsub = null;
    try {
      unsub = Purchases.addCustomerInfoUpdateListener((info) => {
        setCustomerInfo(info);
      });
    } catch {
      // Listener API may not be available on all platforms/versions
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // ── Derive active plan ─────────────────────────────────────────────────────
  const activePlan = (() => {
    const active = customerInfo?.entitlements?.active ?? {};
    if (active[ENTITLEMENT.UNLIMITED]) return 'unlimited';
    if (active[ENTITLEMENT.PRO])       return 'pro';
    if (active[ENTITLEMENT.STARTER])   return 'starter';
    return 'free';
  })();

  const projectLimit = PLAN_LIMITS[activePlan];

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchase = useCallback(async (pkg) => {
    setIsPurchasing(true);
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return info;
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  // ── Restore ────────────────────────────────────────────────────────────────
  const restore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } finally {
      setIsRestoring(false);
    }
  }, []);

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
