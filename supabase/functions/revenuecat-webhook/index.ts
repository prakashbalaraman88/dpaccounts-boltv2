/**
 * Supabase Edge Function: revenuecat-webhook
 *
 * Receives RevenueCat webhook events, validates the HMAC-SHA256 signature,
 * then upserts the user's project_limit in the server-owned user_entitlements
 * table. This is the ONLY writer to that table — the client never touches it.
 *
 * Required environment variables (set in Supabase dashboard):
 *   REVENUECAT_WEBHOOK_SECRET  — from RevenueCat dashboard → Project → Integrations → Webhooks
 *   SUPABASE_URL               — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected by Supabase (bypasses RLS for writes)
 *
 * Relevant RC event types handled:
 *   INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE  → activate entitlement
 *   CANCELLATION, EXPIRATION, BILLING_ISSUE    → downgrade to free tier
 *
 * Plan limit mapping (matches PLAN_LIMITS in src/services/revenuecat.js):
 *   starter   → 10
 *   pro       → 50
 *   unlimited → 2147483647 (MAX INT ≈ Infinity)
 *   free      → 1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLAN_LIMITS: Record<string, number> = {
  starter:   10,
  pro:       50,
  unlimited: 2147483647,
  free:      1,
};

/** Verify the RevenueCat HMAC-SHA256 Authorization header */
async function verifySignature(body: string, authHeader: string | null, secret: string): Promise<boolean> {
  if (!authHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  // RevenueCat sends the raw HMAC hex in the Authorization header
  const expectedBytes = hexToBytes(authHeader);
  const bodyBytes = encoder.encode(body);
  return crypto.subtle.verify('HMAC', key, expectedBytes, bodyBytes);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Derive plan name from active entitlements object */
function resolvePlan(entitlements: Record<string, unknown> | undefined): string {
  if (!entitlements) return 'free';
  if (entitlements['unlimited']) return 'unlimited';
  if (entitlements['pro'])       return 'pro';
  if (entitlements['starter'])   return 'starter';
  return 'free';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET not set');
    return new Response('Server misconfiguration', { status: 500 });
  }

  const body = await req.text();

  // Validate signature
  const authHeader = req.headers.get('Authorization');
  const valid = await verifySignature(body, authHeader, secret);
  if (!valid) {
    console.warn('[revenuecat-webhook] Invalid signature');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload['event'] as Record<string, unknown> | undefined;
  if (!event) {
    return new Response('Missing event', { status: 400 });
  }

  const eventType = event['type'] as string | undefined;
  const appUserId = event['app_user_id'] as string | undefined;

  if (!appUserId) {
    console.warn('[revenuecat-webhook] Missing app_user_id', { eventType });
    return new Response('Missing app_user_id', { status: 400 });
  }

  // Determine new plan based on event type
  let plan: string;
  // SUBSCRIBER_ALIAS is an identity-linking event, not a subscription lapse.
  // Only true lapse/payment signals downgrade the entitlement.
  const lapsedEvents = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'];
  if (lapsedEvents.includes(eventType ?? '')) {
    plan = 'free';
  } else {
    // For active events, derive plan from entitlements in the event payload
    const entitlements = event['entitlements'] as Record<string, unknown> | undefined;
    plan = resolvePlan(entitlements);
    // Fallback: try product identifier if entitlements aren't present
    if (plan === 'free') {
      const productId = (event['product_id'] as string | undefined) ?? '';
      if (productId.includes('unlimited')) plan = 'unlimited';
      else if (productId.includes('pro'))  plan = 'pro';
      else if (productId.includes('starter')) plan = 'starter';
    }
  }

  const projectLimit = PLAN_LIMITS[plan] ?? 1;

  // Upsert using service role key (bypasses RLS — only this function writes here)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await supabase
    .from('user_entitlements')
    .upsert({
      user_id:       appUserId,
      plan,
      project_limit: projectLimit,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[revenuecat-webhook] Upsert failed:', error);
    return new Response('DB error', { status: 500 });
  }

  console.log(`[revenuecat-webhook] ${eventType} → user=${appUserId} plan=${plan} limit=${projectLimit}`);
  return new Response('OK', { status: 200 });
});
