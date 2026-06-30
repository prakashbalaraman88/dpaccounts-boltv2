/**
 * Ledge — RevenueCat seed script
 *
 * Creates the full RevenueCat configuration for Ledge's 3-tier subscription model:
 *   Starter  ₹199/mo — up to 10 projects
 *   Pro      ₹399/mo — up to 50 projects
 *   Unlimited ₹699/mo — unlimited projects
 *
 * Run: npx tsx scripts/seedRevenueCat.ts
 */

import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

// ── Project ───────────────────────────────────────────────────────────────────
const PROJECT_NAME = "Ledge";

// ── App store identifiers ─────────────────────────────────────────────────────
const APP_STORE_APP_NAME     = "Ledge iOS";
const APP_STORE_BUNDLE_ID    = "com.ledge.accounts";
const PLAY_STORE_APP_NAME    = "Ledge Android";
const PLAY_STORE_PACKAGE_NAME = "com.ledge.accounts";

// ── Tiers ─────────────────────────────────────────────────────────────────────
const TIERS = [
  {
    name:               "Starter",
    productId:          "ledge_starter_monthly",
    playProductId:      "ledge_starter_monthly:monthly",
    displayName:        "Ledge Starter Monthly",
    entitlementKey:     "starter",
    entitlementDisplay: "Starter — 10 Projects",
    packageKey:         "ledge_starter",
    packageDisplay:     "Starter Monthly",
    // Test-store price (amount_micros = price × 1,000,000)
    prices: [
      { amount_micros: 199_000_000, currency: "INR" },
      { amount_micros: 2_490_000,   currency: "USD" },
    ],
  },
  {
    name:               "Pro",
    productId:          "ledge_pro_monthly",
    playProductId:      "ledge_pro_monthly:monthly",
    displayName:        "Ledge Pro Monthly",
    entitlementKey:     "pro",
    entitlementDisplay: "Pro — 50 Projects",
    packageKey:         "ledge_pro",
    packageDisplay:     "Pro Monthly",
    prices: [
      { amount_micros: 399_000_000, currency: "INR" },
      { amount_micros: 4_990_000,   currency: "USD" },
    ],
  },
  {
    name:               "Unlimited",
    productId:          "ledge_unlimited_monthly",
    playProductId:      "ledge_unlimited_monthly:monthly",
    displayName:        "Ledge Unlimited Monthly",
    entitlementKey:     "unlimited",
    entitlementDisplay: "Unlimited Projects",
    packageKey:         "ledge_unlimited",
    packageDisplay:     "Unlimited Monthly",
    prices: [
      { amount_micros: 699_000_000, currency: "INR" },
      { amount_micros: 8_990_000,   currency: "USD" },
    ],
  },
];

// ── Offering ─────────────────────────────────────────────────────────────────
const OFFERING_KEY          = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

// ─────────────────────────────────────────────────────────────────────────────

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function ensureProduct(
  client: any,
  projectId: string,
  existingProducts: Product[],
  app: App,
  storeIdentifier: string,
  displayName: string,
  isTestStore: boolean,
  label: string,
): Promise<Product> {
  const existing = existingProducts.find(
    (p) => p.store_identifier === storeIdentifier && p.app_id === app.id,
  );
  if (existing) {
    console.log(`  ✓ ${label} product already exists: ${existing.id}`);
    return existing;
  }

  const body: CreateProductData["body"] = {
    store_identifier: storeIdentifier,
    app_id:           app.id,
    type:             "subscription",
    display_name:     displayName,
  };
  if (isTestStore) {
    body.subscription = { duration: "P1M" };
    body.title        = displayName;
  }

  const { data, error } = await createProduct({
    client,
    path: { project_id: projectId },
    body,
  });
  if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
  console.log(`  ✓ Created ${label} product: ${data.id}`);
  return data;
}

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ── 1. Project ──────────────────────────────────────────────────────────────
  console.log("\n[1/7] Ensuring project…");
  let project: Project;
  const { data: projects, error: listErr } = await listProjects({ client, query: { limit: 20 } });
  if (listErr) throw new Error("Failed to list projects");

  const existing = projects.items?.find((p) => p.name === PROJECT_NAME);
  if (existing) {
    console.log(`  ✓ Project exists: ${existing.id}`);
    project = existing;
  } else {
    const { data, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error) throw new Error("Failed to create project");
    console.log(`  ✓ Created project: ${data.id}`);
    project = data;
  }

  // ── 2. Apps ─────────────────────────────────────────────────────────────────
  console.log("\n[2/7] Ensuring apps (test store, iOS, Android)…");
  const { data: apps, error: appsErr } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (appsErr || !apps?.items.length) throw new Error("No apps found in project");

  let testApp     = apps.items.find((a) => a.type === "test_store");
  let iosApp      = apps.items.find((a) => a.type === "app_store");
  let androidApp  = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test store app found — check RevenueCat project");
  console.log(`  ✓ Test store: ${testApp.id}`);

  if (!iosApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error(`Failed to create iOS app: ${JSON.stringify(error)}`);
    iosApp = data;
    console.log(`  ✓ Created iOS app: ${iosApp.id}`);
  } else {
    console.log(`  ✓ iOS app exists: ${iosApp.id}`);
  }

  if (!androidApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error(`Failed to create Android app: ${JSON.stringify(error)}`);
    androidApp = data;
    console.log(`  ✓ Created Android app: ${androidApp.id}`);
  } else {
    console.log(`  ✓ Android app exists: ${androidApp.id}`);
  }

  // ── 3. Products ──────────────────────────────────────────────────────────────
  console.log("\n[3/7] Ensuring products for each tier × store…");
  const { data: existingProducts, error: prodErr } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (prodErr) throw new Error("Failed to list products");

  type TierProducts = { test: Product; ios: Product; android: Product };
  const tierProducts: Record<string, TierProducts> = {};

  for (const tier of TIERS) {
    console.log(`\n  [${tier.name}]`);
    const test    = await ensureProduct(client, project.id, existingProducts.items ?? [], testApp,   tier.productId,     tier.displayName, true,  `${tier.name}/test`);
    const ios     = await ensureProduct(client, project.id, existingProducts.items ?? [], iosApp,    tier.productId,     tier.displayName, false, `${tier.name}/iOS`);
    const android = await ensureProduct(client, project.id, existingProducts.items ?? [], androidApp, tier.playProductId, tier.displayName, false, `${tier.name}/Android`);
    tierProducts[tier.productId] = { test, ios, android };

    // Set test-store prices
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url:  "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: test.id },
      body: { prices: tier.prices },
    });
    if (priceError) {
      if (typeof priceError === "object" && "type" in priceError && (priceError as any).type === "resource_already_exists") {
        console.log(`  ✓ Test-store prices already set for ${tier.name}`);
      } else {
        throw new Error(`Failed to set test-store prices for ${tier.name}: ${JSON.stringify(priceError)}`);
      }
    } else {
      console.log(`  ✓ Test-store prices set for ${tier.name}`);
    }
  }

  // ── 4. Entitlements ──────────────────────────────────────────────────────────
  console.log("\n[4/7] Ensuring entitlements…");
  const { data: existingEnt, error: entErr } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (entErr) throw new Error("Failed to list entitlements");

  const entitlements: Record<string, Entitlement> = {};

  for (const tier of TIERS) {
    const existing = existingEnt.items?.find((e) => e.lookup_key === tier.entitlementKey);
    if (existing) {
      console.log(`  ✓ Entitlement "${tier.entitlementKey}" exists: ${existing.id}`);
      entitlements[tier.entitlementKey] = existing;
    } else {
      const { data, error } = await createEntitlement({
        client,
        path: { project_id: project.id },
        body: { lookup_key: tier.entitlementKey, display_name: tier.entitlementDisplay },
      });
      if (error) throw new Error(`Failed to create entitlement "${tier.entitlementKey}": ${JSON.stringify(error)}`);
      console.log(`  ✓ Created entitlement "${tier.entitlementKey}": ${data.id}`);
      entitlements[tier.entitlementKey] = data;
    }
  }

  // ── 5. Attach products → entitlements ────────────────────────────────────────
  console.log("\n[5/7] Attaching products to entitlements…");
  for (const tier of TIERS) {
    const { test, ios, android } = tierProducts[tier.productId];
    const ent = entitlements[tier.entitlementKey];
    const { error } = await attachProductsToEntitlement({
      client,
      path: { project_id: project.id, entitlement_id: ent.id },
      body: { product_ids: [test.id, ios.id, android.id] },
    });
    if (error) {
      if (typeof error === "object" && "type" in error && (error as any).type === "unprocessable_entity_error") {
        console.log(`  ✓ Products already attached to "${tier.entitlementKey}"`);
      } else {
        throw new Error(`Failed to attach products to entitlement "${tier.entitlementKey}": ${JSON.stringify(error)}`);
      }
    } else {
      console.log(`  ✓ Attached products to "${tier.entitlementKey}"`);
    }
  }

  // ── 6. Offering ──────────────────────────────────────────────────────────────
  console.log("\n[6/7] Ensuring offering…");
  const { data: existingOfferings, error: offerErr } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (offerErr) throw new Error("Failed to list offerings");

  let offering: Offering;
  const existingOffer = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_KEY);
  if (existingOffer) {
    console.log(`  ✓ Offering exists: ${existingOffer.id}`);
    offering = existingOffer;
  } else {
    const { data, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_KEY, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error(`Failed to create offering: ${JSON.stringify(error)}`);
    console.log(`  ✓ Created offering: ${data.id}`);
    offering = data;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("  ✓ Set offering as current");
  }

  // ── 7. Packages ──────────────────────────────────────────────────────────────
  console.log("\n[7/7] Ensuring packages and attaching products…");
  const { data: existingPkgs, error: pkgErr } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (pkgErr) throw new Error("Failed to list packages");

  for (const tier of TIERS) {
    let pkg: Package;
    const existingPkg = existingPkgs.items?.find((p) => p.lookup_key === tier.packageKey);
    if (existingPkg) {
      console.log(`  ✓ Package "${tier.packageKey}" exists: ${existingPkg.id}`);
      pkg = existingPkg;
    } else {
      const { data, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: tier.packageKey, display_name: tier.packageDisplay },
      });
      if (error) throw new Error(`Failed to create package "${tier.packageKey}": ${JSON.stringify(error)}`);
      console.log(`  ✓ Created package "${tier.packageKey}": ${data.id}`);
      pkg = data;
    }

    const { test, ios, android } = tierProducts[tier.productId];
    const { error: attachErr } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: test.id,    eligibility_criteria: "all" },
          { product_id: ios.id,     eligibility_criteria: "all" },
          { product_id: android.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachErr) {
      if (typeof attachErr === "object" && "type" in attachErr && (attachErr as any).type === "unprocessable_entity_error") {
        console.log(`  ✓ Products already attached to package "${tier.packageKey}"`);
      } else {
        throw new Error(`Failed to attach products to package "${tier.packageKey}": ${JSON.stringify(attachErr)}`);
      }
    } else {
      console.log(`  ✓ Attached products to package "${tier.packageKey}"`);
    }
  }

  // ── Output ────────────────────────────────────────────────────────────────────
  const { data: testKeys }    = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testApp.id } });
  const { data: iosKeys }     = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: iosApp.id } });
  const { data: androidKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: androidApp.id } });

  console.log(`
╔════════════════════════════════════════════════════╗
  RevenueCat setup complete for Ledge!
╚════════════════════════════════════════════════════╝

Save these as Replit environment variables:

REVENUECAT_PROJECT_ID=${project.id}
REVENUECAT_TEST_STORE_APP_ID=${testApp.id}
REVENUECAT_APPLE_APP_STORE_APP_ID=${iosApp.id}
REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=${androidApp.id}

EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=${testKeys?.items.map((k) => k.key).join(", ") ?? "N/A"}
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${iosKeys?.items.map((k) => k.key).join(", ") ?? "N/A"}
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=${androidKeys?.items.map((k) => k.key).join(", ") ?? "N/A"}

Entitlement identifiers (use in client code):
  starter, pro, unlimited

Package keys (offerings → packages):
  ledge_starter, ledge_pro, ledge_unlimited
`);
}

seedRevenueCat().catch((e) => {
  console.error("\n✗ Seed failed:", e.message || e);
  process.exit(1);
});
