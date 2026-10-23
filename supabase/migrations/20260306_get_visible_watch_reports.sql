-- ============================================================
-- Update RPC Function to return full watch reports by service
-- ============================================================
-- This extends the existing get_visible_watch_reports function to also accept
-- a service_id parameter and return full report data (not just IDs)
-- Filters at the database level for security, preventing unauthorized access via API

-- Create overloaded version that returns full report data when called with service_id
-- This is the version used by the useVeilleReports hook for frontend filtering
CREATE OR REPLACE FUNCTION public.get_visible_watch_reports(
    p_service_id UUID
)
RETURNS TABLE (
    id uuid,
    created_at timestamp with time zone,
    period_start date,
    period_end date,
    topic text,
    frequency text,
    source_model text,
    analysis_model text,
    raw_research text,
    executive_summary text,
    risks text,
    opportunities text,
    recommended_actions text,
    importance_score integer,
    tags text[],
    metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        awr.id,
        awr.created_at,
        awr.period_start,
        awr.period_end,
        awr.topic,
        awr.frequency,
        awr.source_model,
        awr.analysis_model,
        awr.raw_research,
        awr.executive_summary,
        awr.risks,
        awr.opportunities,
        awr.recommended_actions,
        awr.importance_score,
        awr.tags,
        awr.metadata
    FROM public.ai_watch_reports awr
    WHERE EXISTS (
        -- Check if there's a visible watch_config for this report's topic
        SELECT 1
        FROM public.watch_config wc
        WHERE wc.topic = awr.topic
          AND wc.active = true
          AND (
              -- Config is global (service_ids is NULL or empty)
              wc.service_ids IS NULL
              OR wc.service_ids = '{}'
              -- OR user's service is in the config's service_ids
              OR p_service_id = ANY(wc.service_ids)
          )
    )
    ORDER BY awr.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_visible_watch_reports(UUID) TO authenticated;
