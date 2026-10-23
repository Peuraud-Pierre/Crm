-- ============================================================
-- Row-Level Security (RLS) Policies for Veille Module
-- Prevents unauthorized access at the database level
-- ============================================================
-- Date: 2026-03-06
-- Purpose: Enforce service-based access control for watch_config
--          and ai_watch_reports tables to prevent users from
--          accessing data directly via API that isn't authorized
--          through the frontend.
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTIONS FOR RLS CHECKS
-- ============================================================

-- Function to check if a user is a global admin
-- Returns true if the user has 'superadmin' role
CREATE OR REPLACE FUNCTION public.veille_user_is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role_slug = 'superadmin' FROM public.user_role_and_service(p_user_id) LIMIT 1),
    false
  );
$$;

-- Function to get the service ID for a user
-- Returns the service ID from the user's profile
CREATE OR REPLACE FUNCTION public.veille_user_service_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT service_id
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

-- Function to check if a watch_config is visible to a user's service
-- Logic:
--   - Admins can see all configs
--   - service_ids IS NULL → visible to all services (global config)
--   - service_ids contains user's service_id → visible
--   - Otherwise → not visible
CREATE OR REPLACE FUNCTION public.veille_config_visible_to_user(
  p_config_id INT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_ids UUID[];
  v_user_service_id UUID;
BEGIN
  -- Admins can always see all configs
  IF public.veille_user_is_admin(p_user_id) THEN
    RETURN true;
  END IF;

  -- Get user's service ID
  v_user_service_id := public.veille_user_service_id(p_user_id);

  -- If user has no service, deny access
  IF v_user_service_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get the config's service_ids
  SELECT service_ids INTO v_service_ids
  FROM public.watch_config
  WHERE id = p_config_id;

  -- If service_ids is NULL or empty, config is visible to all services
  IF v_service_ids IS NULL OR v_service_ids = '{}' THEN
    RETURN true;
  END IF;

  -- Check if user's service is in the service_ids array
  RETURN v_user_service_id = ANY(v_service_ids);
END;
$$;

-- ============================================================
-- 2. ENABLE RLS ON WATCH_CONFIG TABLE
-- ============================================================

ALTER TABLE public.watch_config ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can SELECT all watch_config rows
CREATE POLICY IF NOT EXISTS "veille_watch_config_admin_select"
  ON public.watch_config
  FOR SELECT
  USING (public.veille_user_is_admin(auth.uid()));

-- Policy: Regular users can SELECT only visible watch_config rows
-- Visible if: service_ids IS NULL (global) OR user's service_id is in service_ids
CREATE POLICY IF NOT EXISTS "veille_watch_config_user_select"
  ON public.watch_config
  FOR SELECT
  USING (
    NOT public.veille_user_is_admin(auth.uid())
    AND (
      service_ids IS NULL
      OR service_ids = '{}'
      OR public.veille_user_service_id(auth.uid()) = ANY(service_ids)
    )
  );

-- Policy: Only admins can INSERT new watch_config rows
CREATE POLICY IF NOT EXISTS "veille_watch_config_admin_insert"
  ON public.watch_config
  FOR INSERT
  WITH CHECK (public.veille_user_is_admin(auth.uid()));

-- Policy: Only admins can UPDATE watch_config rows
CREATE POLICY IF NOT EXISTS "veille_watch_config_admin_update"
  ON public.watch_config
  FOR UPDATE
  USING (public.veille_user_is_admin(auth.uid()))
  WITH CHECK (public.veille_user_is_admin(auth.uid()));

-- Policy: Only admins can DELETE watch_config rows
CREATE POLICY IF NOT EXISTS "veille_watch_config_admin_delete"
  ON public.watch_config
  FOR DELETE
  USING (public.veille_user_is_admin(auth.uid()));

-- ============================================================
-- 3. ENABLE RLS ON AI_WATCH_REPORTS TABLE
-- ============================================================

-- First, verify the ai_watch_reports table exists
-- If it doesn't have a watch_config reference, we'll need to add one
ALTER TABLE public.ai_watch_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can SELECT all reports
CREATE POLICY IF NOT EXISTS "veille_ai_watch_reports_admin_select"
  ON public.ai_watch_reports
  FOR SELECT
  USING (public.veille_user_is_admin(auth.uid()));

-- Policy: Regular users can SELECT reports where the associated watch_config is visible
-- This requires the report's topic to match a visible watch_config
-- Note: This assumes there's a way to link reports to configs via topic
CREATE POLICY IF NOT EXISTS "veille_ai_watch_reports_user_select"
  ON public.ai_watch_reports
  FOR SELECT
  USING (
    NOT public.veille_user_is_admin(auth.uid())
    AND EXISTS (
      -- Check if there's a visible watch_config with the same topic
      SELECT 1
      FROM public.watch_config wc
      WHERE wc.topic = ai_watch_reports.topic
        AND (
          wc.service_ids IS NULL
          OR wc.service_ids = '{}'
          OR public.veille_user_service_id(auth.uid()) = ANY(wc.service_ids)
        )
        AND wc.active = true
    )
  );

-- Policy: Only admins can INSERT new reports
CREATE POLICY IF NOT EXISTS "veille_ai_watch_reports_admin_insert"
  ON public.ai_watch_reports
  FOR INSERT
  WITH CHECK (public.veille_user_is_admin(auth.uid()));

-- Policy: Only admins can UPDATE reports
CREATE POLICY IF NOT EXISTS "veille_ai_watch_reports_admin_update"
  ON public.ai_watch_reports
  FOR UPDATE
  USING (public.veille_user_is_admin(auth.uid()))
  WITH CHECK (public.veille_user_is_admin(auth.uid()));

-- Policy: Only admins can DELETE reports
CREATE POLICY IF NOT EXISTS "veille_ai_watch_reports_admin_delete"
  ON public.ai_watch_reports
  FOR DELETE
  USING (public.veille_user_is_admin(auth.uid()));

-- ============================================================
-- 4. RPC FUNCTION: GET VISIBLE WATCH REPORTS FOR USER
-- ============================================================
-- This function returns all report IDs that are visible to a given user
-- based on their service and the watch_config service visibility rules
--
-- Usage: SELECT * FROM public.get_visible_watch_reports(user_id);
-- Or via RPC: await supabase.rpc('get_visible_watch_reports', { p_user_id: userId });

CREATE OR REPLACE FUNCTION public.get_visible_watch_reports(
  p_user_id UUID,
  p_service_id UUID DEFAULT NULL
)
RETURNS TABLE(report_id TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_service_id UUID;
BEGIN
  -- Check if user is admin
  v_is_admin := public.veille_user_is_admin(p_user_id);

  -- Use provided service_id or get from user's profile
  IF p_service_id IS NOT NULL THEN
    v_service_id := p_service_id;
  ELSE
    v_service_id := public.veille_user_service_id(p_user_id);
  END IF;

  -- Return all visible reports
  RETURN QUERY
  SELECT DISTINCT awr.id::TEXT
  FROM public.ai_watch_reports awr
  WHERE
    -- Admins see all reports
    (v_is_admin)
    OR
    -- Non-admins see reports from visible watch_configs
    (
      NOT v_is_admin
      AND EXISTS (
        SELECT 1
        FROM public.watch_config wc
        WHERE wc.topic = awr.topic
          AND wc.active = true
          AND (
            -- Config is global (service_ids is NULL or empty)
            wc.service_ids IS NULL
            OR wc.service_ids = '{}'
            -- OR user's service is in the config's service_ids
            OR v_service_id = ANY(wc.service_ids)
          )
      )
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_visible_watch_reports(UUID, UUID) TO authenticated;

-- ============================================================
-- 5. RPC FUNCTION: GET VISIBLE WATCH CONFIGS FOR USER
-- ============================================================
-- This function returns all watch_config IDs that are visible to a given user
--
-- Usage: SELECT * FROM public.get_visible_watch_configs(user_id);
-- Or via RPC: await supabase.rpc('get_visible_watch_configs', { p_user_id: userId });

CREATE OR REPLACE FUNCTION public.get_visible_watch_configs(
  p_user_id UUID,
  p_service_id UUID DEFAULT NULL
)
RETURNS TABLE(config_id INT, config_name TEXT, config_topic TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_service_id UUID;
BEGIN
  -- Check if user is admin
  v_is_admin := public.veille_user_is_admin(p_user_id);

  -- Use provided service_id or get from user's profile
  IF p_service_id IS NOT NULL THEN
    v_service_id := p_service_id;
  ELSE
    v_service_id := public.veille_user_service_id(p_user_id);
  END IF;

  -- Return all visible configs
  RETURN QUERY
  SELECT wc.id, wc.name, wc.topic
  FROM public.watch_config wc
  WHERE
    -- Admins see all configs
    (v_is_admin)
    OR
    -- Non-admins see only visible configs
    (
      NOT v_is_admin
      AND wc.active = true
      AND (
        -- Config is global (service_ids is NULL or empty)
        wc.service_ids IS NULL
        OR wc.service_ids = '{}'
        -- OR user's service is in the config's service_ids
        OR v_service_id = ANY(wc.service_ids)
      )
    )
  ORDER BY wc.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_visible_watch_configs(UUID, UUID) TO authenticated;

-- ============================================================
-- 6. COMMENTS AND DOCUMENTATION
-- ============================================================

COMMENT ON TABLE public.watch_config IS
'Watch configuration table for monitoring topics.
  - service_ids: UUID array of services this config applies to. NULL = applies to all services.
  - RLS enforces that users can only see configs visible to their service.
  - Admins (role=superadmin) bypass RLS and see all configs.';

COMMENT ON TABLE public.ai_watch_reports IS
'AI-generated watch reports. Access is controlled by the watch_config service visibility.
  - Users can only see reports from watch_configs visible to their service.
  - Admins see all reports.
  - Topic column links reports to watch_config topics.';

COMMENT ON FUNCTION public.veille_user_is_admin(UUID) IS
'Check if a user is a global admin (superadmin role).
  Returns true only for users with superadmin role.';

COMMENT ON FUNCTION public.veille_user_service_id(UUID) IS
'Get the service ID for a user from their profile.
  Returns NULL if user has no associated service.';

COMMENT ON FUNCTION public.veille_config_visible_to_user(INT, UUID) IS
'Check if a specific watch_config is visible to a user.
  - Returns true for admins (all configs visible)
  - Returns true if config.service_ids is NULL (global config)
  - Returns true if user''s service_id is in config.service_ids
  - Returns false otherwise.';

COMMENT ON FUNCTION public.get_visible_watch_reports(UUID, UUID) IS
'RPC function to get all report IDs visible to a user.
  Parameters:
    p_user_id: The user to check visibility for
    p_service_id: Optional override service ID (for testing)
  Returns a table with report_id column.
  Used by frontend to fetch reports after RLS filtering.';

COMMENT ON FUNCTION public.get_visible_watch_configs(UUID, UUID) IS
'RPC function to get all watch_configs visible to a user.
  Parameters:
    p_user_id: The user to check visibility for
    p_service_id: Optional override service ID (for testing)
  Returns a table with config_id, config_name, config_topic columns.
  Used by frontend to fetch configs after RLS filtering.';

-- ============================================================
-- 7. SECURITY NOTES
-- ============================================================
--
-- RLS Enforcement:
-- 1. All SELECT, INSERT, UPDATE, DELETE queries on watch_config and
--    ai_watch_reports will be subject to RLS policies
-- 2. Direct API calls (e.g., via supabase-js) respect RLS
-- 3. Admin users (role='superadmin') bypass regular policies and see all data
-- 4. Regular users see only data visible to their service
--
-- Service Visibility Model:
-- - watch_config.service_ids = NULL → visible to ALL services (global)
-- - watch_config.service_ids = [] → visible to ALL services (global)
-- - watch_config.service_ids = ['uuid1', 'uuid2'] → visible ONLY to those services
--
-- ai_watch_reports Access:
-- - Reports are linked to watch_config via the topic column
-- - Users see reports from topics that have visible watch_configs
-- - This creates an indirect access control via watch_config visibility
--
-- Performance Considerations:
-- - RLS functions are STABLE and use SECURITY DEFINER for safety
-- - GIN index on watch_config.service_ids speeds up array containment checks
-- - Consider adding index on ai_watch_reports.topic for report filtering
-- ============================================================
