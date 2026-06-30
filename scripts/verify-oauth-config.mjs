/**
 * verify-oauth-config.mjs
 *
 * Run with:  node scripts/verify-oauth-config.mjs
 *
 * Checks every prerequisite for Google OAuth to work end-to-end in Ledge.
 * Does NOT perform an actual OAuth login — it validates the configuration
 * layer so you know exactly what is set up and what still needs to be done.
 */

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://sdnarwantjvwqzkaxwhc.supabase.co';
const EXPECTED_SCHEME = 'interiorbooks';
const REQUIRED_GOOGLE_REDIRECT_URI = `${SUPABASE_URL}/auth/v1/callback`;

// Read the Supabase anon key from supabase.js without executing it
const supabaseJs = fs.readFileSync('src/services/supabase.js', 'utf8');
const anonKeyMatch = supabaseJs.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
const ANON_KEY = anonKeyMatch?.[1] ?? '';

const results = [];

function check(label, passed, detail = '') {
  results.push({ label, passed, detail });
}

// ── 1. app.json scheme ────────────────────────────────────────────────────────
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const scheme = appJson.expo?.scheme;
check(
  'app.json → expo.scheme is set',
  !!scheme,
  scheme ? `scheme = "${scheme}"` : 'Missing! Add: "scheme": "interiorbooks" to app.json'
);
check(
  'app.json → scheme matches "interiorbooks"',
  scheme === EXPECTED_SCHEME,
  scheme === EXPECTED_SCHEME
    ? `Correct: "${scheme}"`
    : `Got "${scheme}", expected "${EXPECTED_SCHEME}"`
);

// ── 2. src/services/auth.js ───────────────────────────────────────────────────
const authJs = fs.readFileSync('src/services/auth.js', 'utf8');
check(
  'auth.js → makeRedirectUri uses scheme "interiorbooks"',
  authJs.includes("scheme: 'interiorbooks'"),
  authJs.includes("scheme: 'interiorbooks'") ? 'OK' : 'Missing scheme in makeRedirectUri()'
);
check(
  'auth.js → makeRedirectUri uses path "auth/callback"',
  authJs.includes("path: 'auth/callback'"),
  authJs.includes("path: 'auth/callback'") ? 'OK' : 'Missing path in makeRedirectUri()'
);
check(
  'auth.js → skipBrowserRedirect: true (PKCE)',
  authJs.includes('skipBrowserRedirect: true'),
  authJs.includes('skipBrowserRedirect: true') ? 'OK' : 'Missing — required for PKCE on native'
);
check(
  'auth.js → exchangeCodeForSession called',
  authJs.includes('exchangeCodeForSession'),
  authJs.includes('exchangeCodeForSession') ? 'OK' : 'Missing — session will never be established'
);
check(
  'auth.js → redirect_uri_mismatch error detection',
  authJs.includes('redirect_uri_mismatch'),
  authJs.includes('redirect_uri_mismatch')
    ? 'OK — users get an actionable message if Google Cloud Console is misconfigured'
    : 'Missing — users would see a cryptic error'
);
check(
  'auth.js → PKCE code presence validated before exchange',
  authJs.includes("searchParams.get('code')"),
  authJs.includes("searchParams.get('code')") ? 'OK' : 'Missing — exchange will fail silently'
);
check(
  'auth.js → session existence validated after exchange',
  authJs.includes('sessionData?.session'),
  authJs.includes('sessionData?.session') ? 'OK' : 'Missing — null session would propagate silently'
);

// ── 3. src/services/supabase.js ───────────────────────────────────────────────
const supabaseContent = fs.readFileSync('src/services/supabase.js', 'utf8');
check(
  'supabase.js → uses correct project URL',
  supabaseContent.includes('sdnarwantjvwqzkaxwhc.supabase.co'),
  supabaseContent.includes('sdnarwantjvwqzkaxwhc.supabase.co')
    ? `URL: ${SUPABASE_URL}`
    : 'Wrong URL — check for typos or stale config'
);
check(
  'supabase.js → AsyncStorage session persistence',
  supabaseContent.includes('AsyncStorage'),
  supabaseContent.includes('AsyncStorage') ? 'OK — session survives app restart' : 'Missing!'
);
check(
  'supabase.js → persistSession: true',
  supabaseContent.includes('persistSession: true'),
  supabaseContent.includes('persistSession: true') ? 'OK' : 'Missing!'
);
check(
  'supabase.js → autoRefreshToken: true',
  supabaseContent.includes('autoRefreshToken: true'),
  supabaseContent.includes('autoRefreshToken: true') ? 'OK' : 'Missing!'
);

// ── 4. app/_layout.js auth-gated routing ─────────────────────────────────────
const layoutJs = fs.readFileSync('app/_layout.js', 'utf8');
check(
  'app/_layout.js → auth-gated routing present',
  layoutJs.includes('login') && layoutJs.includes('user'),
  layoutJs.includes('login') ? 'OK — unauthenticated users redirect to /login' : 'Missing routing guard'
);

// ── 5. Live Supabase checks (network) ─────────────────────────────────────────
console.log('\nChecking live Supabase configuration...\n');

try {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: ANON_KEY },
  });
  const settings = await res.json();
  const googleEnabled = settings?.external?.google === true;
  const emailEnabled = settings?.external?.email === true;

  check(
    'Supabase → reachable',
    res.ok,
    res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} — cannot reach Supabase`
  );
  check(
    'Supabase → email auth enabled',
    emailEnabled,
    emailEnabled ? 'OK' : 'Email auth is disabled in Supabase Dashboard'
  );
  check(
    'Supabase → Google OAuth provider enabled',
    googleEnabled,
    googleEnabled
      ? 'OK — Google provider is configured in Supabase'
      : [
          'NOT ENABLED — action required:',
          '  1. Go to Supabase Dashboard → Authentication → Providers → Google',
          '  2. Enable Google provider',
          '  3. Enter Client ID + Client Secret from Google Cloud Console',
          `  4. Supabase callback URL to add in Google Cloud Console: ${REQUIRED_GOOGLE_REDIRECT_URI}`,
        ].join('\n')
  );
} catch (e) {
  check('Supabase → reachable', false, `Network error: ${e.message}`);
}

// ── Print results ──────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.passed);
const failed = results.filter((r) => !r.passed);

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           Google OAuth Configuration Verification            ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon}  ${r.label}`);
  if (r.detail) {
    const lines = r.detail.split('\n');
    for (const line of lines) console.log(`      ${line}`);
  }
}

console.log(`\n${'─'.repeat(64)}`);
console.log(`Results: ${passed.length} passed, ${failed.length} failed\n`);

if (failed.length === 0) {
  console.log('🎉 All checks passed! Google OAuth is ready to test.');
} else {
  console.log('Action required — fix the ❌ items above before testing Google sign-in.');
  if (failed.some((r) => r.label.includes('Google OAuth provider enabled'))) {
    console.log('\nRequired Supabase callback URL to register in Google Cloud Console:');
    console.log(`  ${REQUIRED_GOOGLE_REDIRECT_URI}`);
  }
}
