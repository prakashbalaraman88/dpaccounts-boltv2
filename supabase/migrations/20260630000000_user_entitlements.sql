-- Table: user_entitlements
--
-- Stores the server-authoritative subscription entitlement for each user.
-- Written exclusively by the revenuecat-webhook Edge Function (service role).
-- Readable by each user via RLS (they can read their own row only).
-- The client NEVER writes here — the row is populated/updated by RevenueCat
-- webhook events processed server-side.
--
-- project_limit maps to PLAN_LIMITS in src/services/revenuecat.js:
--   free      → 1
--   starter   → 10
--   pro       → 50
--   unlimited → 2147483647  (MAX INT, representing Infinity)
--
-- When no row exists for a user they default to the free tier (limit 1).

CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          text    NOT NULL DEFAULT 'free',
  project_limit integer NOT NULL DEFAULT 1,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: each user can read their own entitlement row
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entitlement"
  ON user_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies for non-service-role callers.
-- The Edge Function uses the service-role key to bypass RLS on writes.
