/**
 * Ledge — RevenueCat seed script
 *
 * Creates the full RevenueCat configuration for Ledge's 3-tier subscription:
 *   Starter  ₹199/mo — up to 10 projects  — entitlement: "starter"
 *   Pro      ₹399/mo — up to 50 projects  — entitlement: "pro"
 *   Unlimited ₹699/mo — unlimited          — entitlement: "unlimited"
 *
 * Run: npx tsx scripts/seedRevenueCat.ts
 */

import { rcApi } from "./revenueCatClient";

// ── Constants ─────────────────────────────────────────────────────────────────
const PROJECT_NAME         = "Ledge";
const IOS_BUNDLE_ID        = "com.ledge.accounts";
const ANDROID_PACKAGE_NAME = "com.ledge.accounts";
const OFFERING_KEY         = "default";

const TIERS = [
  {
    name:            "Starter",
    productId:       "ledge_starter_monthly",
    androidProdId:   "ledge_starter_monthly:monthly",
    displayName:     "Ledge Starter Monthly",
    entitlement:     "starter",
    entitlementDisplay: "Starter — 10 Projects",
    packageKey:      "ledge_starter",
    packageDisplay:  "Starter Monthly",
    prices: [{ amount_micros: 199_000_000, currency: "INR" }],
  },
  {
    name:            "Pro",
    productId:       "ledge_pro_monthly",
    androidProdId:   "ledge_pro_monthly:monthly",
    displayName:     "Ledge Pro Monthly",
    entitlement:     "pro",
    entitlementDisplay: "Pro — 50 Projects",
    packageKey:      "ledge_pro",
    packageDisplay:  "Pro Monthly",
    prices: [{ amount_micros: 399_000_000, currency: "INR" }],
  },
  {
    name:            "Unlimited",
    productId:       "ledge_unlimited_monthly",
    androidProdId:   "ledge_unlimited_monthly:monthly",
    displayName:     "Ledge Unlimited Monthly",
    entitlement:     "unlimited",
    entitlementDisplay: "Unlimited Projects",
    packageKey:      "ledge_unlimited",
    packageDisplay:  "Unlimited Monthly",
    prices: [{ amount_micros: 699_000_000, currency: "INR" }],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok<T>(result: { data: T; error: null } | { data: null; error: any }, label: string): T {
  if (result.error) {
    throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  }
  return result.data as T;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {

  // 1. Project
  console.log("\n[1/7] Ensuring project…");
  const projectsRes = ok(await rcApi.get<any>("/projects?limit=20"), "list projects");
  let project = (projectsRes.items ?? []).find((p: any) => p.name === PROJECT_NAME);
  if (project) {
    console.log(`  ✓ exists: ${project.id}`);
  } else {
    project = ok(await rcApi.post<any>("/projects", { name: PROJECT_NAME }), "create project");
    console.log(`  ✓ created: ${project.id}`);
  }
  const pid = project.id;

  // 2. Apps
  console.log("\n[2/7] Ensuring apps (test-store, iOS, Android)…");
  const appsRes = ok(await rcApi.get<any>(`/projects/${pid}/apps?limit=20`), "list apps");
  const allApps: any[] = appsRes.items ?? [];

  let testApp  = allApps.find((a: any) => a.type === "amazon" || a.type === "test_store" || a.store === "test_store");
  let iosApp   = allApps.find((a: any) => a.type === "app_store"  || a.store === "app_store");
  let droidApp = allApps.find((a: any) => a.type === "play_store" || a.store === "play_store");

  if (!testApp) {
    // RevenueCat auto-creates a test/sandbox app for every project
    // Try to find any sandbox-type app
    testApp = allApps[0];
    if (!testApp) throw new Error("No apps found in project — check RevenueCat dashboard");
  }
  console.log(`  ✓ test/sandbox: ${testApp.id} (${testApp.type ?? testApp.store ?? "unknown"})`);

  if (!iosApp) {
    iosApp = ok(
      await rcApi.post<any>(`/projects/${pid}/apps`, {
        name: "Ledge iOS",
        type: "app_store",
        app_store: { bundle_id: IOS_BUNDLE_ID },
      }),
      "create iOS app"
    );
    console.log(`  ✓ created iOS app: ${iosApp.id}`);
  } else {
    console.log(`  ✓ iOS app exists: ${iosApp.id}`);
  }

  if (!droidApp) {
    droidApp = ok(
      await rcApi.post<any>(`/projects/${pid}/apps`, {
        name: "Ledge Android",
        type: "play_store",
        play_store: { package_name: ANDROID_PACKAGE_NAME },
      }),
      "create Android app"
    );
    console.log(`  ✓ created Android: ${droidApp.id}`);
  } else {
    console.log(`  ✓ Android app exists: ${droidApp.id}`);
  }

  // 3. Products
  console.log("\n[3/7] Ensuring products…");
  const prodsRes = ok(await rcApi.get<any>(`/projects/${pid}/products?limit=100`), "list products");
  const allProds: any[] = prodsRes.items ?? [];

  const tierProductIds: Record<string, { test: string; ios: string; android: string }> = {};

  for (const tier of TIERS) {
    const findProd = (appId: string, storeId: string) =>
      allProds.find((p: any) => p.app_id === appId && p.store_identifier === storeId);

    async function ensureProd(appId: string, storeId: string, label: string) {
      let p = findProd(appId, storeId);
      if (p) { console.log(`  ✓ ${label}: ${p.id}`); return p.id as string; }
      const isTest = appId === testApp.id;
      p = ok(
        await rcApi.post<any>(`/projects/${pid}/products`, {
          store_identifier: storeId,
          app_id: appId,
          type: "subscription",
          display_name: tier.displayName,
          ...(isTest ? {
            title: tier.displayName,
            subscription: { duration: "P1M" },
          } : {}),
        }),
        `create ${label}`
      );
      console.log(`  ✓ created ${label}: ${p.id}`);
      return p.id as string;
    }

    console.log(`  [${tier.name}]`);
    const testId  = await ensureProd(testApp.id,  tier.productId,      `${tier.name}/test`);
    const iosId   = await ensureProd(iosApp.id,   tier.productId,      `${tier.name}/ios`);
    const droidId = await ensureProd(droidApp.id, tier.androidProdId,  `${tier.name}/android`);
    tierProductIds[tier.productId] = { test: testId, ios: iosId, android: droidId };
  }

  // 4. Entitlements
  console.log("\n[4/7] Ensuring entitlements…");
  const entRes = ok(await rcApi.get<any>(`/projects/${pid}/entitlements?limit=20`), "list entitlements");
  const allEnts: any[] = entRes.items ?? [];
  const entMap: Record<string, string> = {};

  for (const tier of TIERS) {
    let ent = allEnts.find((e: any) => e.lookup_key === tier.entitlement);
    if (ent) {
      console.log(`  ✓ "${tier.entitlement}" exists: ${ent.id}`);
    } else {
      ent = ok(
        await rcApi.post<any>(`/projects/${pid}/entitlements`, {
          lookup_key: tier.entitlement,
          display_name: tier.entitlementDisplay,
        }),
        `create entitlement ${tier.entitlement}`
      );
      console.log(`  ✓ created "${tier.entitlement}": ${ent.id}`);
    }
    entMap[tier.entitlement] = ent.id;
  }

  // 5. Attach products → entitlements
  console.log("\n[5/7] Attaching products to entitlements…");
  for (const tier of TIERS) {
    const { test, ios, android } = tierProductIds[tier.productId];
    const entId = entMap[tier.entitlement];
    const r = await rcApi.post(`/projects/${pid}/entitlements/${entId}/actions/attach_products`, {
      product_ids: [test, ios, android],
    });
    if (r.error && r.error?.type !== "unprocessable_entity_error") {
      throw new Error(`attach products to "${tier.entitlement}": ${JSON.stringify(r.error)}`);
    }
    console.log(`  ✓ products → "${tier.entitlement}"`);
  }

  // 6. Offering
  console.log("\n[6/7] Ensuring offering…");
  const offRes = ok(await rcApi.get<any>(`/projects/${pid}/offerings?limit=20`), "list offerings");
  const allOffs: any[] = offRes.items ?? [];
  let offering = allOffs.find((o: any) => o.lookup_key === OFFERING_KEY);

  if (offering) {
    console.log(`  ✓ offering exists: ${offering.id}`);
  } else {
    offering = ok(
      await rcApi.post<any>(`/projects/${pid}/offerings`, {
        lookup_key: OFFERING_KEY,
        display_name: "Default Offering",
      }),
      "create offering"
    );
    console.log(`  ✓ created offering: ${offering.id}`);
  }

  if (!offering.is_current) {
    ok(
      await rcApi.patch(`/projects/${pid}/offerings/${offering.id}`, { is_current: true }),
      "set offering current"
    );
    console.log("  ✓ set as current");
  }

  // 7. Packages
  console.log("\n[7/7] Ensuring packages…");
  const pkgRes = ok(
    await rcApi.get<any>(`/projects/${pid}/offerings/${offering.id}/packages?limit=20`),
    "list packages"
  );
  const allPkgs: any[] = pkgRes.items ?? [];

  for (const tier of TIERS) {
    let pkg = allPkgs.find((p: any) => p.lookup_key === tier.packageKey);
    if (pkg) {
      console.log(`  ✓ package "${tier.packageKey}" exists: ${pkg.id}`);
    } else {
      pkg = ok(
        await rcApi.post<any>(`/projects/${pid}/offerings/${offering.id}/packages`, {
          lookup_key: tier.packageKey,
          display_name: tier.packageDisplay,
        }),
        `create package ${tier.packageKey}`
      );
      console.log(`  ✓ created package "${tier.packageKey}": ${pkg.id}`);
    }

    const { test, ios, android } = tierProductIds[tier.productId];
    const ar = await rcApi.post(`/projects/${pid}/packages/${pkg.id}/actions/attach_products`, {
      products: [
        { product_id: test,    eligibility_criteria: "all" },
        { product_id: ios,     eligibility_criteria: "all" },
        { product_id: android, eligibility_criteria: "all" },
      ],
    });
    if (ar.error && ar.error?.type !== "unprocessable_entity_error") {
      throw new Error(`attach products to package "${tier.packageKey}": ${JSON.stringify(ar.error)}`);
    }
    console.log(`  ✓ products → package "${tier.packageKey}"`);
  }

  // ── Public API keys ─────────────────────────────────────────────────────────
  console.log("\n[+] Fetching public API keys…");
  const testKeys  = await rcApi.get<any>(`/projects/${pid}/apps/${testApp.id}/public_api_keys`);
  const iosKeys   = await rcApi.get<any>(`/projects/${pid}/apps/${iosApp.id}/public_api_keys`);
  const droidKeys = await rcApi.get<any>(`/projects/${pid}/apps/${droidApp.id}/public_api_keys`);

  const pick = (r: any) => (r.data?.items ?? []).map((k: any) => k.key).join(", ") || "N/A";

  console.log(`
╔══════════════════════════════════════════════════════╗
  RevenueCat seed complete for Ledge!
╚══════════════════════════════════════════════════════╝

Set these as Replit environment variables:

REVENUECAT_PROJECT_ID=${pid}
REVENUECAT_TEST_STORE_APP_ID=${testApp.id}
REVENUECAT_APPLE_APP_STORE_APP_ID=${iosApp.id}
REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=${droidApp.id}

EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=${pick(testKeys)}
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${pick(iosKeys)}
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=${pick(droidKeys)}

Entitlement identifiers: starter, pro, unlimited
Package keys: ledge_starter, ledge_pro, ledge_unlimited
`);
}

seed().catch((e) => {
  console.error("\n✗ Seed failed:", e.message ?? e);
  process.exit(1);
});
