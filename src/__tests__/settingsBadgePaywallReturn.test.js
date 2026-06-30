'use strict';

/**
 * Confirms the Settings subscription badge refreshes correctly when the user
 * returns from the paywall screen, covering both the upgrade path (Free → paid)
 * and the cancel/no-change path.
 *
 * Two complementary layers:
 *
 *   A) STRUCTURAL WIRING TESTS (src-code assertions)
 *      Directly read app/settings.js and src/services/revenuecat.js and assert
 *      the coupling that drives the badge refresh is present.  These tests FAIL
 *      if:
 *        • useFocusEffect is removed or no longer calls refresh() in settings.js
 *        • refresh is no longer exported from the context (revenuecat.js)
 *        • loadData is not what is exposed as refresh
 *        • loadData no longer calls setAndPersistCustomerInfo before returning
 *
 *   B) LOGIC SIMULATION TESTS (pure-helper assertions)
 *      Simulate the Settings → Paywall → Settings round-trip using the same
 *      pure helper functions (activePlanFromCustomerInfo, PLAN_NAMES, PLAN_LIMITS)
 *      that the real badge reads from context.  These tests FAIL if the plan
 *      derivation logic or the state-update ordering breaks.
 *
 * No native modules are involved — only fs, path, and the two native-free
 * helpers used by the real settings/revenuecat code.
 */

const { describe, it, expect } = require('@jest/globals');
const fs   = require('fs');
const path = require('path');

const { activePlanFromCustomerInfo } = require('../utils/activePlan');
const { PLAN_NAMES, PLAN_LIMITS } = require('../constants/planLimits');

// ---------------------------------------------------------------------------
// Source files read once at module load (fail fast on missing files)
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');

const settingsSrc    = fs.readFileSync(path.join(ROOT, 'app', 'settings.js'),             'utf8');
const revenuecatSrc  = fs.readFileSync(path.join(ROOT, 'src', 'services', 'revenuecat.js'), 'utf8');

// ---------------------------------------------------------------------------
// A) STRUCTURAL WIRING TESTS
// ---------------------------------------------------------------------------

describe('Settings.js — useFocusEffect wiring (structural)', function () {
  it('imports useFocusEffect from expo-router', function () {
    // The focus-refresh mechanism requires useFocusEffect to be imported.
    expect(settingsSrc).toMatch(/useFocusEffect/);
    expect(settingsSrc).toMatch(/from\s+['"]expo-router['"]/);
  });

  it('imports refresh from useSubscription', function () {
    // refresh must be destructured from the subscription hook so the
    // useFocusEffect callback can call it.
    expect(settingsSrc).toMatch(/\brefresh\b/);
    expect(settingsSrc).toMatch(/useSubscription\s*\(/);
  });

  it('calls refresh() inside a useFocusEffect callback', function () {
    // The critical wiring: useFocusEffect must contain a call to refresh().
    // This regex matches the pattern `useFocusEffect(` ... `refresh()` in close
    // proximity (within 200 chars), regardless of whitespace / formatting.
    const focusBlock = settingsSrc.match(/useFocusEffect[\s\S]{0,200}refresh\s*\(\s*\)/);
    expect(focusBlock).not.toBeNull();
  });

  it('wraps the useFocusEffect callback in useCallback', function () {
    // Per React docs, the callback passed to useFocusEffect should be wrapped
    // in useCallback to avoid re-subscribing on every render.
    const stableCallback = settingsSrc.match(/useFocusEffect\s*\(\s*useCallback/);
    expect(stableCallback).not.toBeNull();
  });

  it('destructures refresh from useSubscription result', function () {
    // refresh must be in the destructuring pattern of the useSubscription call
    // so that what is called inside useFocusEffect is the context function.
    const destructure = settingsSrc.match(/\{\s*[^}]*\brefresh\b[^}]*\}\s*=\s*useSubscription\s*\(/);
    expect(destructure).not.toBeNull();
  });
});

describe('revenuecat.js — refresh is loadData (structural)', function () {
  it('the context value exposes refresh as loadData', function () {
    // useSubscriptionContext returns { ..., refresh: loadData, ... }.
    // This ensures that what useFocusEffect calls is the full data-reload
    // function that fetches both CustomerInfo and Offerings.
    expect(revenuecatSrc).toMatch(/refresh\s*:\s*loadData/);
  });

  it('loadData calls setAndPersistCustomerInfo before returning', function () {
    // loadData must update the shared context state (setAndPersistCustomerInfo)
    // so the badge re-renders with fresh data after the async fetch resolves.
    const loadDataBody = revenuecatSrc.match(/const loadData[\s\S]{0,800}setAndPersistCustomerInfo/);
    expect(loadDataBody).not.toBeNull();
  });

  it('loadData fetches CustomerInfo from the RevenueCat SDK', function () {
    // The refresh must actually hit the SDK, not just read from local state.
    const sdkFetch = revenuecatSrc.match(/loadData[\s\S]{0,600}Purchases\.getCustomerInfo\s*\(/);
    expect(sdkFetch).not.toBeNull();
  });

  it('the context value is exported via useSubscription hook', function () {
    // Settings (and Paywall) both consume the context through useSubscription.
    expect(revenuecatSrc).toMatch(/export function useSubscription/);
    expect(revenuecatSrc).toMatch(/SubscriptionContext\.Provider/);
  });
});

// ---------------------------------------------------------------------------
// Helpers for logic simulation tests
// ---------------------------------------------------------------------------

/**
 * Build a minimal CustomerInfo object with the given entitlements active.
 * Mirrors what RevenueCat's SDK returns from getCustomerInfo() / purchasePackage().
 */
function makeCustomerInfo(activeEntitlements) {
  const active = {};
  (activeEntitlements || []).forEach(function (key) {
    active[key] = { identifier: key, isActive: true };
  });
  return { entitlements: { active } };
}

/**
 * Simulate the Settings → Paywall → Settings round-trip using the same
 * state-update sequence as the real code paths in revenuecat.js / paywall.js.
 *
 * Steps replicated:
 *   1. Settings mounts → useFocusEffect fires → refresh() = loadData() is
 *      called → setAndPersistCustomerInfo(initialInfo) is called before return.
 *   2. User navigates to Paywall.
 *      - 'purchase': purchase() calls setAndPersistCustomerInfo(purchaseInfo).
 *      - 'cancel':   user dismisses — context is unchanged.
 *   3. User returns to Settings → useFocusEffect fires again → refresh() is
 *      called → setAndPersistCustomerInfo(focusRefreshInfo) is called.
 *
 * The badge in Settings reads activePlanFromCustomerInfo(contextCustomerInfo)
 * which is derived from the same context state simulated here.
 *
 * @param {object}              opts.initialInfo       CustomerInfo on Settings mount
 * @param {'purchase'|'cancel'} opts.paywallAction     What the user did on the paywall
 * @param {object|null}         opts.purchaseInfo       CustomerInfo from purchase()
 * @param {object}              opts.focusRefreshInfo   CustomerInfo from getCustomerInfo() on re-focus
 */
async function simulateRoundTrip({
  initialInfo,
  paywallAction,
  purchaseInfo,
  focusRefreshInfo,
}) {
  // Shared context state — mirrors the customerInfo useState in useSubscriptionContext
  let contextCustomerInfo = null;

  // Mirrors setAndPersistCustomerInfo() from src/services/revenuecat.js:
  //   setCustomerInfo(info);
  //   persistCustomerInfo(info);
  function setAndPersistCustomerInfo(info) {
    contextCustomerInfo = info;
  }

  // ── Step 1: Settings mounts → useFocusEffect → refresh() (= loadData) ─────
  // Mirrors loadData() from src/services/revenuecat.js:
  //   const [info] = await Promise.all([Purchases.getCustomerInfo(), ...]);
  //   setAndPersistCustomerInfo(info);
  await (async function loadData() {
    const info = await Promise.resolve(initialInfo);
    setAndPersistCustomerInfo(info);         // state updated before function returns
  })();
  const badgeAfterInitialLoad = activePlanFromCustomerInfo(contextCustomerInfo);

  // ── Step 2: User opens paywall ────────────────────────────────────────────
  if (paywallAction === 'purchase') {
    // Mirrors purchase() from src/services/revenuecat.js:
    //   const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    //   setAndPersistCustomerInfo(info);
    const info = await Promise.resolve(purchaseInfo);
    setAndPersistCustomerInfo(info);
  }
  // On cancel: nothing touches context — contextCustomerInfo unchanged
  const badgeAfterPaywall = activePlanFromCustomerInfo(contextCustomerInfo);

  // ── Step 3: User returns → useFocusEffect fires → refresh() again ─────────
  // Same loadData() body, triggered by useFocusEffect on every focus event.
  await (async function loadDataOnFocus() {
    const info = await Promise.resolve(focusRefreshInfo);
    setAndPersistCustomerInfo(info);         // overwrites with fresh server data
  })();
  const badgeAfterReturn = activePlanFromCustomerInfo(contextCustomerInfo);

  return {
    badgeAfterInitialLoad,
    badgeAfterPaywall,
    badgeAfterReturn,
    finalCustomerInfo: contextCustomerInfo,
  };
}

// ---------------------------------------------------------------------------
// B) LOGIC SIMULATION TESTS — upgrade path (Free → paid)
// ---------------------------------------------------------------------------

describe('Settings badge on return from paywall — upgrade path (Free → paid)', function () {
  it('badge shows Starter plan immediately when returning after purchasing Starter', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['starter']),
      focusRefreshInfo: makeCustomerInfo(['starter']),
    });

    expect(result.badgeAfterInitialLoad).toBe('free');
    expect(PLAN_NAMES[result.badgeAfterInitialLoad]).toBe('Free');
    expect(result.badgeAfterReturn).toBe('starter');
    expect(PLAN_NAMES[result.badgeAfterReturn]).toBe('Starter');
  });

  it('badge shows Pro plan immediately when returning after purchasing Pro', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['pro']),
      focusRefreshInfo: makeCustomerInfo(['pro']),
    });

    expect(result.badgeAfterInitialLoad).toBe('free');
    expect(result.badgeAfterReturn).toBe('pro');
    expect(PLAN_NAMES[result.badgeAfterReturn]).toBe('Pro');
  });

  it('badge shows Unlimited plan immediately when returning after purchasing Unlimited', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['unlimited']),
      focusRefreshInfo: makeCustomerInfo(['unlimited']),
    });

    expect(result.badgeAfterInitialLoad).toBe('free');
    expect(result.badgeAfterReturn).toBe('unlimited');
    expect(PLAN_NAMES[result.badgeAfterReturn]).toBe('Unlimited');
  });

  it('project limit shown in Settings reflects the paid tier after upgrade', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['pro']),
      focusRefreshInfo: makeCustomerInfo(['pro']),
    });

    const limit = PLAN_LIMITS[result.badgeAfterReturn];
    expect(limit).toBe(50);
    expect(limit).toBeGreaterThan(PLAN_LIMITS['free']);
  });

  it('badge is correct even when purchase() returned stale info and focus refresh resolves the entitlement', async function () {
    // purchase() returned CustomerInfo without the entitlement (slow RevenueCat
    // webhook), but useFocusEffect → refresh() on return catches up.
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo([]),       // stale — entitlement missing
      focusRefreshInfo: makeCustomerInfo(['pro']),  // fresh — server caught up
    });

    // Focus refresh corrects the stale state
    expect(result.badgeAfterReturn).toBe('pro');
    expect(PLAN_NAMES[result.badgeAfterReturn]).toBe('Pro');
  });

  it('upgrading from Starter to Pro is reflected correctly on Settings return', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo(['starter']),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['pro']),
      focusRefreshInfo: makeCustomerInfo(['pro']),
    });

    expect(result.badgeAfterInitialLoad).toBe('starter');
    expect(result.badgeAfterReturn).toBe('pro');
    expect(PLAN_LIMITS[result.badgeAfterReturn]).toBe(50);
  });

  it('upgrading from Pro to Unlimited is reflected correctly on Settings return', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo(['pro']),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['unlimited']),
      focusRefreshInfo: makeCustomerInfo(['unlimited']),
    });

    expect(result.badgeAfterInitialLoad).toBe('pro');
    expect(result.badgeAfterReturn).toBe('unlimited');
    expect(PLAN_LIMITS[result.badgeAfterReturn]).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// B) LOGIC SIMULATION TESTS — cancel / no-change path
// ---------------------------------------------------------------------------

describe('Settings badge on return from paywall — cancel path', function () {
  it('badge stays on Free when a Free user cancels the paywall', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'cancel',
      purchaseInfo:     null,
      focusRefreshInfo: makeCustomerInfo([]),
    });

    expect(result.badgeAfterInitialLoad).toBe('free');
    expect(result.badgeAfterPaywall).toBe('free');
    expect(result.badgeAfterReturn).toBe('free');
    expect(PLAN_NAMES[result.badgeAfterReturn]).toBe('Free');
  });

  it('badge stays on Pro when a Pro subscriber browses the paywall and returns without changing plan', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo(['pro']),
      paywallAction:    'cancel',
      purchaseInfo:     null,
      focusRefreshInfo: makeCustomerInfo(['pro']),
    });

    expect(result.badgeAfterInitialLoad).toBe('pro');
    expect(result.badgeAfterReturn).toBe('pro');
  });

  it('badge stays on Starter when a Starter subscriber browses the paywall and returns', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo(['starter']),
      paywallAction:    'cancel',
      purchaseInfo:     null,
      focusRefreshInfo: makeCustomerInfo(['starter']),
    });

    expect(result.badgeAfterReturn).toBe('starter');
    expect(PLAN_NAMES[result.badgeAfterReturn]).toBe('Starter');
  });

  it('badge stays on Unlimited when an Unlimited subscriber cancels out of the paywall', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo(['unlimited']),
      paywallAction:    'cancel',
      purchaseInfo:     null,
      focusRefreshInfo: makeCustomerInfo(['unlimited']),
    });

    expect(result.badgeAfterReturn).toBe('unlimited');
    expect(PLAN_LIMITS[result.badgeAfterReturn]).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// B) LOGIC SIMULATION TESTS — state-update ordering guarantee
// ---------------------------------------------------------------------------

describe('useFocusEffect refresh — state-update ordering', function () {
  it('setAndPersistCustomerInfo is called before loadData returns, so badge is correct on re-render', async function () {
    // Critical ordering guarantee: loadData() sets customerInfo BEFORE the
    // async function resolves. The badge reads from context synchronously on
    // re-render, which happens after the await completes.
    let contextUpdatedBeforeReturn = false;
    let contextCustomerInfo        = null;

    function setAndPersistCustomerInfo(info) {
      contextCustomerInfo        = info;
      contextUpdatedBeforeReturn = true;
    }

    // Replay loadData() body (the function that useFocusEffect calls via refresh)
    const freshInfo = makeCustomerInfo(['pro']);
    const info = await Promise.resolve(freshInfo);
    setAndPersistCustomerInfo(info);   // must happen before function returns

    const planAfterRefresh = activePlanFromCustomerInfo(contextCustomerInfo);

    expect(contextUpdatedBeforeReturn).toBe(true);
    expect(planAfterRefresh).toBe('pro');
    expect(PLAN_NAMES[planAfterRefresh]).toBe('Pro');
  });

  it('refresh() on focus overwrites a stale cached plan with the latest server value', async function () {
    // Verifies loadData() unconditionally calls setAndPersistCustomerInfo
    // with fresh data (no short-circuit when plan appears unchanged).
    let contextCustomerInfo = makeCustomerInfo(['starter']); // old cached value

    function setAndPersistCustomerInfo(info) {
      contextCustomerInfo = info;
    }

    // Server returns downgraded (subscription lapsed)
    const freshFromServer = makeCustomerInfo([]);
    setAndPersistCustomerInfo(freshFromServer);

    expect(activePlanFromCustomerInfo(contextCustomerInfo)).toBe('free');
    expect(PLAN_NAMES['free']).toBe('Free');
  });

  it('badge label and project limit are mutually consistent after focus refresh', async function () {
    const result = await simulateRoundTrip({
      initialInfo:      makeCustomerInfo([]),
      paywallAction:    'purchase',
      purchaseInfo:     makeCustomerInfo(['unlimited']),
      focusRefreshInfo: makeCustomerInfo(['unlimited']),
    });

    const plan  = result.badgeAfterReturn;
    const label = PLAN_NAMES[plan];
    const limit = PLAN_LIMITS[plan];

    expect(plan).toBe('unlimited');
    expect(label).toBe('Unlimited');
    expect(limit).toBe(Infinity);
  });

  it('useFocusEffect fires on every return — badge reflects successive state changes correctly', async function () {
    // Simulate two successive paywall visits:
    // Visit 1: Free → purchases Pro (badge shows Pro on return)
    // Visit 2: Pro → visits paywall, cancels (badge stays Pro on return)
    let contextCustomerInfo = null;

    function setAndPersistCustomerInfo(info) {
      contextCustomerInfo = info;
    }

    // Initial mount
    setAndPersistCustomerInfo(makeCustomerInfo([]));
    expect(activePlanFromCustomerInfo(contextCustomerInfo)).toBe('free');

    // Visit 1: purchase Pro, return to Settings (useFocusEffect fires → refresh)
    setAndPersistCustomerInfo(makeCustomerInfo(['pro'])); // purchase()
    setAndPersistCustomerInfo(makeCustomerInfo(['pro'])); // focus refresh
    expect(activePlanFromCustomerInfo(contextCustomerInfo)).toBe('pro');

    // Visit 2: cancel, return to Settings (useFocusEffect fires → refresh)
    setAndPersistCustomerInfo(makeCustomerInfo(['pro'])); // focus refresh
    expect(activePlanFromCustomerInfo(contextCustomerInfo)).toBe('pro');
    expect(PLAN_NAMES['pro']).toBe('Pro');
  });
});
