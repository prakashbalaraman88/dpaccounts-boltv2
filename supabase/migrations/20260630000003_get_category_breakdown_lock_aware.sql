-- RPC: get_category_breakdown (lock-aware replacement)
--
-- Aggregates transaction categories only for unlocked projects — those
-- within the authenticated user's entitlement limit — using the same
-- ranking/lock logic as get_project_lock_status().
--
-- Locked projects are silently excluded so dashboard analytics are
-- consistent with what the user can actually access.
--
-- Returns: category_id, category_label, type, total (sum), count
--
-- Note: depends on user_entitlements (20260630000000) and the messages
-- table (used for project ranking).

CREATE OR REPLACE FUNCTION get_category_breakdown()
RETURNS TABLE (
  category_id   text,
  category_label text,
  type          text,
  total         numeric,
  count         bigint
)
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
  ),
  unlocked_project_ids AS (
    SELECT id
    FROM ranked
    WHERE rn <= (SELECT lim FROM user_limit)
  )
  SELECT
    t.category_id,
    t.category_label,
    t.type,
    SUM(t.amount)  AS total,
    COUNT(*)       AS count
  FROM transactions t
  WHERE t.project_id IN (SELECT id FROM unlocked_project_ids)
    AND t.category_id IS NOT NULL
  GROUP BY t.category_id, t.category_label, t.type
  ORDER BY total DESC;
$$;
