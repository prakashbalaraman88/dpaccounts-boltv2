-- RPC: get_project_lock_status
--
-- Returns the server-authoritative lock status for every project the
-- authenticated user can see (RLS still applies — SECURITY INVOKER default).
--
-- Entitlement source: user_entitlements table, written exclusively by the
-- revenuecat-webhook Edge Function (service role). The client never supplies
-- the plan limit — it is always read from server-owned state.
--
-- Users with no entitlement row default to the free tier (limit 1).
--
-- Logic: projects are ranked by most-recent activity (latest message
-- created_at, falling back to project created_at). Any project whose rank
-- exceeds the stored project_limit is locked.
--
-- Usage (JS):
--   const { data } = await supabase.rpc('get_project_lock_status');
--   // data: Array<{ id: number, locked: boolean }>
--
-- Note: depends on the user_entitlements table created in migration
-- 20260630000001_user_entitlements.sql.

CREATE OR REPLACE FUNCTION get_project_lock_status()
RETURNS TABLE (id bigint, locked boolean)
LANGUAGE sql
STABLE
AS $$
  WITH user_limit AS (
    -- Read the server-owned entitlement; default to free tier (1) if absent
    SELECT COALESCE(
      (SELECT project_limit FROM user_entitlements WHERE user_id = auth.uid()),
      1
    ) AS lim
  ),
  latest_activity AS (
    SELECT
      project_id,
      MAX(created_at) AS last_message_time
    FROM messages
    GROUP BY project_id
  ),
  ranked AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(la.last_message_time, p.created_at) DESC
      ) AS rn
    FROM projects p
    LEFT JOIN latest_activity la ON la.project_id = p.id
  )
  SELECT
    ranked.id,
    (ranked.rn > (SELECT lim FROM user_limit)) AS locked
  FROM ranked
  ORDER BY ranked.rn;
$$;

-- RPC: is_project_locked
--
-- Returns whether a single project is beyond the user's entitlement limit.
-- Called by loadProject (appStore.js) before loading full project data so
-- direct deep-link navigation cannot bypass the lock check.

CREATE OR REPLACE FUNCTION is_project_locked(p_project_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH user_limit AS (
    SELECT COALESCE(
      (SELECT project_limit FROM user_entitlements WHERE user_id = auth.uid()),
      1
    ) AS lim
  ),
  latest_activity AS (
    SELECT
      project_id,
      MAX(created_at) AS last_message_time
    FROM messages
    GROUP BY project_id
  ),
  ranked AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(la.last_message_time, p.created_at) DESC
      ) AS rn
    FROM projects p
    LEFT JOIN latest_activity la ON la.project_id = p.id
  )
  SELECT (rn > (SELECT lim FROM user_limit))
  FROM ranked
  WHERE id = p_project_id;
$$;
