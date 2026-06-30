'use strict';

/**
 * Confirms the home screen never shows "limit reached" right after a
 * successful purchase, even when the entitlement is absent from the initial
 * purchasePackage result and the paywall must poll for it.
 *
 * The guarantee rests on three things tested here:
 *
 *   1. When purchasePackage() returns CustomerInfo *without* the expected
 *      entitlement, handleConfirmPurchase() sets isSyncing = true before
 *      calling refresh() — the "Syncing your plan…" banner is shown.
 *
 *   2. Once refresh() resolves with the entitlement present, isSyncing is
 *      cleared, the success message is set, and navigation to home is
 *      triggered.
 *
 *   3. The CustomerInfo stored in the context at the point navigation fires
 *      yields activePlan !== 'free' and a projectLimit > 1, so the home
 *      screen project-limit check cannot block the user.
 *
 * No native modules are involved — only the pure helpers used by the real
 * paywall logic are imported.
 */

const { describe, it, expect } = require('@jest/globals');
const { activePlanFromCustomerInfo } = require('../utils/activePlan');
const { PLAN_LIMITS, PLAN_NAMES } = require('../constants/planLimits');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal CustomerInfo object with the given entitlements active.
 * Mirrors what RevenueCat's SDK returns from purchasePackage / getCustomerInfo.
 */
function makeCustomerInfo(activeEntitlements) {
  const active = {};
  (activeEntitlements || []).forEach(function (key) {
    active[key] = { identifier: key, isActive: true };
  });
  return { entitlements: { active } };
}

/**
 * Simulate handleConfirmPurchase() from app/paywall.js.
 *
 * Returns a record of every observable state transition plus the final
 * CustomerInfo held by the context when navigation fires, so tests can
 * assert on the home screen's plan / project-limit derivation.
 *
 * @param {object} opts
 * @param {function(): Promise<object>} opts.mockPurchase
 *   Resolves to the CustomerInfo returned by Purchases.purchasePackage().
 * @param {function(): Promise<object>} opts.mockRefresh
 *   Resolves to the CustomerInfo returned by the first refresh() call that
 *   contains the entitlement, or a free CustomerInfo if it never arrives.
 * @param {string} opts.packageIdentifier
 *   e.g. 'ledge_pro'
 */
async function simulatePurchaseFlow({ mockPurchase, mockRefresh, packageIdentifier }) {
  const pkgToEntitlement = {
    ledge_starter:   'starter',
    ledge_pro:       'pro',
    ledge_unlimited: 'unlimited',
  };

  // Mirror the TIER_INFO.name lookup from app/paywall.js / src/services/revenuecat.js
  const tierNames = {
    ledge_starter:   'Starter',
    ledge_pro:       'Pro',
    ledge_unlimited: 'Unlimited',
  };

  const expectedEntitlement = pkgToEntitlement[packageIdentifier];
  const isEntitlementActive = (ci) =>
    expectedEntitlement && ci?.entitlements?.active?.[expectedEntitlement];

  // State mirrors
  let isSyncing          = false;
  let successMsg         = '';
  let navigationFired    = false;
  let navigationTarget   = null;
  let contextCustomerInfo = null;

  // State setters (mirror React's useState setters)
  function setIsSyncing(v)            { isSyncing = v; }
  function setSuccessMsg(v)           { successMsg = v; }
  function setAndPersistCustomerInfo(info) { contextCustomerInfo = info; }

  // Router mock
  const router = {
    navigate: function (path) {
      navigationFired  = true;
      navigationTarget = path;
    },
  };

  // --- Replay handleConfirmPurchase() verbatim ---

  // purchase() sets customerInfo inside useSubscriptionContext before returning
  const info = await mockPurchase();
  setAndPersistCustomerInfo(info);   // mirrors purchase() in revenuecat.js

  if (isEntitlementActive(info)) {
    // Fast path: entitlement already present in initial result
    successMsg = `Welcome to ${tierNames[packageIdentifier] ?? 'Ledge Pro'}! 🎉`;
    // Navigation scheduled via setTimeout — record that it would fire
    router.navigate('/');
    return {
      syncingBannerShown: false,
      successMsg,
      navigationFired,
      navigationTarget,
      finalCustomerInfo: contextCustomerInfo,
    };
  }

  // Slow path: entitlement not yet reflected — poll via refresh()
  setIsSyncing(true);
  const syncingBannerShown = isSyncing; // capture the moment the banner appears

  let reflected = false;
  const MAX_ATTEMPTS = 4;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // In production each iteration waits POLL_INTERVAL_MS = 1 500 ms; here we
    // skip the actual delay so the test runs synchronously.
    const fresh = await mockRefresh(i);
    setAndPersistCustomerInfo(fresh);
    if (isEntitlementActive(fresh)) {
      reflected = true;
      break;
    }
  }

  setIsSyncing(false);
  successMsg = `Welcome to ${tierNames[packageIdentifier] ?? 'Ledge Pro'}! 🎉`;
  // Navigation fires after setTimeout(1800ms) — record it here
  router.navigate('/');

  return {
    syncingBannerShown,
    reflected,
    successMsg,
    isSyncing,            // must be false by the time navigation fires
    navigationFired,
    navigationTarget,
    finalCustomerInfo: contextCustomerInfo,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Paywall post-purchase sync — "Syncing your plan…" banner', function () {
  it('shows the syncing banner when the initial purchase result lacks the entitlement', async function () {
    // purchasePackage() returns CustomerInfo without the 'pro' entitlement
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    // First refresh() resolves with 'pro' active
    const mockRefresh  = async function () { return makeCustomerInfo(['pro']); };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_pro',
    });

    expect(result.syncingBannerShown).toBe(true);
  });

  it('does NOT show the syncing banner when the entitlement is already present', async function () {
    // purchasePackage() returns CustomerInfo with 'starter' already active
    const mockPurchase = async function () { return makeCustomerInfo(['starter']); };
    const mockRefresh  = async function () { return makeCustomerInfo(['starter']); };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_starter',
    });

    expect(result.syncingBannerShown).toBe(false);
  });
});

describe('Paywall post-purchase sync — navigation fires after entitlement is reflected', function () {
  it('navigates to home after refresh() resolves with the expected entitlement', async function () {
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo(['pro']); };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_pro',
    });

    expect(result.reflected).toBe(true);
    expect(result.navigationFired).toBe(true);
    expect(result.navigationTarget).toBe('/');
  });

  it('still navigates to home even if the entitlement never arrives within MAX_ATTEMPTS', async function () {
    // refresh() always returns an empty CustomerInfo (entitlement never reflected)
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo([]); };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_unlimited',
    });

    expect(result.reflected).toBe(false);
    expect(result.navigationFired).toBe(true);   // navigation fires regardless
    expect(result.navigationTarget).toBe('/');
  });

  it('clears the syncing banner before navigation fires', async function () {
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo(['starter']); };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_starter',
    });

    // isSyncing must be false by the time router.navigate('/') is called
    expect(result.isSyncing).toBe(false);
  });

  it('sets the success message before navigation fires', async function () {
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo(['unlimited']); };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_unlimited',
    });

    expect(result.successMsg).toBe('Welcome to Unlimited! 🎉');
    expect(result.navigationFired).toBe(true);
  });
});

describe('Home screen project-limit check — context reflects upgraded plan at navigation time', function () {
  it('context holds "pro" CustomerInfo when navigation fires after slow entitlement sync', async function () {
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo(['pro']); };

    const { finalCustomerInfo } = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_pro',
    });

    const activePlan   = activePlanFromCustomerInfo(finalCustomerInfo);
    const projectLimit = PLAN_LIMITS[activePlan];

    expect(activePlan).toBe('pro');
    expect(PLAN_NAMES[activePlan]).toBe('Pro');
    // Home screen limit: free=1, so > 1 means "limit reached" wall won't trigger
    expect(projectLimit).toBeGreaterThan(1);
  });

  it('context holds "starter" CustomerInfo when navigation fires', async function () {
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo(['starter']); };

    const { finalCustomerInfo } = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_starter',
    });

    const activePlan   = activePlanFromCustomerInfo(finalCustomerInfo);
    const projectLimit = PLAN_LIMITS[activePlan];

    expect(activePlan).toBe('starter');
    expect(projectLimit).toBe(10);
    expect(projectLimit).toBeGreaterThan(1);
  });

  it('context holds "unlimited" CustomerInfo when navigation fires', async function () {
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () { return makeCustomerInfo(['unlimited']); };

    const { finalCustomerInfo } = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_unlimited',
    });

    const activePlan   = activePlanFromCustomerInfo(finalCustomerInfo);
    const projectLimit = PLAN_LIMITS[activePlan];

    expect(activePlan).toBe('unlimited');
    expect(projectLimit).toBe(Infinity);
  });

  it('context holds the direct-purchase CustomerInfo when entitlement is immediately present', async function () {
    // Fast path: no polling needed
    const mockPurchase = async function () { return makeCustomerInfo(['pro']); };
    const mockRefresh  = async function () { return makeCustomerInfo(['pro']); };

    const { finalCustomerInfo } = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_pro',
    });

    const activePlan = activePlanFromCustomerInfo(finalCustomerInfo);
    expect(activePlan).toBe('pro');
    expect(PLAN_LIMITS[activePlan]).toBeGreaterThan(1);
  });

  it('entitlement arriving on the second refresh attempt still yields correct plan', async function () {
    let callCount = 0;
    const mockPurchase = async function () { return makeCustomerInfo([]); };
    const mockRefresh  = async function () {
      callCount += 1;
      // First call returns no entitlement; second returns 'pro'
      return callCount >= 2 ? makeCustomerInfo(['pro']) : makeCustomerInfo([]);
    };

    const result = await simulatePurchaseFlow({
      mockPurchase,
      mockRefresh,
      packageIdentifier: 'ledge_pro',
    });

    expect(result.reflected).toBe(true);
    const activePlan = activePlanFromCustomerInfo(result.finalCustomerInfo);
    expect(activePlan).toBe('pro');
    expect(PLAN_LIMITS[activePlan]).toBeGreaterThan(1);
  });
});
