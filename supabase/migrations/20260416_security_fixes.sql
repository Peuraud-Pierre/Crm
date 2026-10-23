-- ============================================================
-- Security fixes (audit 2026-04-16)
-- ============================================================
-- 1. get_visible_watch_reports(UUID) : ajout contrôle auth.uid()
-- 2. get_visible_watch_reports(UUID, UUID) : ajout contrôle auth.uid()
-- 3. get_visible_watch_configs(UUID, UUID) : ajout contrôle auth.uid()
-- 4. DROP table orpheline cryptedmessage_userkeys_devices
--    (contient encrypted_privkey avec policy SELECT USING (true))
-- ============================================================

-- ============================================================
-- 1. Fix : get_visible_watch_reports(UUID)
-- ============================================================
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Guard: caller must be admin OR be in the service they're querying
    IF NOT public.veille_user_is_admin(auth.uid())
       AND public.veille_user_service_id(auth.uid()) IS DISTINCT FROM p_service_id THEN
        RAISE EXCEPTION 'Unauthorized: cannot query reports for a service you do not belong to';
    END IF;

    RETURN QUERY
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
        SELECT 1
        FROM public.watch_config wc
        WHERE wc.topic = awr.topic
          AND wc.active = true
          AND (
              wc.service_ids IS NULL
              OR wc.service_ids = '{}'
              OR p_service_id = ANY(wc.service_ids)
          )
    )
    ORDER BY awr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_watch_reports(UUID) TO authenticated;

-- ============================================================
-- 2. Fix : get_visible_watch_reports(UUID, UUID)
-- ============================================================
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
    -- Guard: p_user_id must match caller
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: p_user_id must match auth.uid()';
    END IF;

    v_is_admin := public.veille_user_is_admin(p_user_id);

    IF p_service_id IS NOT NULL THEN
        -- Non-admins cannot override their own service
        IF NOT v_is_admin AND p_service_id IS DISTINCT FROM public.veille_user_service_id(p_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: cannot override service_id';
        END IF;
        v_service_id := p_service_id;
    ELSE
        v_service_id := public.veille_user_service_id(p_user_id);
    END IF;

    RETURN QUERY
    SELECT DISTINCT awr.id::TEXT
    FROM public.ai_watch_reports awr
    WHERE
        (v_is_admin)
        OR
        (
            NOT v_is_admin
            AND EXISTS (
                SELECT 1
                FROM public.watch_config wc
                WHERE wc.topic = awr.topic
                  AND wc.active = true
                  AND (
                      wc.service_ids IS NULL
                      OR wc.service_ids = '{}'
                      OR v_service_id = ANY(wc.service_ids)
                  )
            )
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_watch_reports(UUID, UUID) TO authenticated;

-- ============================================================
-- 3. Fix : get_visible_watch_configs(UUID, UUID)
-- ============================================================
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
    -- Guard: p_user_id must match caller
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: p_user_id must match auth.uid()';
    END IF;

    v_is_admin := public.veille_user_is_admin(p_user_id);

    IF p_service_id IS NOT NULL THEN
        IF NOT v_is_admin AND p_service_id IS DISTINCT FROM public.veille_user_service_id(p_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: cannot override service_id';
        END IF;
        v_service_id := p_service_id;
    ELSE
        v_service_id := public.veille_user_service_id(p_user_id);
    END IF;

    RETURN QUERY
    SELECT wc.id, wc.name, wc.topic
    FROM public.watch_config wc
    WHERE
        (v_is_admin)
        OR
        (
            NOT v_is_admin
            AND wc.active = true
            AND (
                wc.service_ids IS NULL
                OR wc.service_ids = '{}'
                OR v_service_id = ANY(wc.service_ids)
            )
        )
    ORDER BY wc.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_watch_configs(UUID, UUID) TO authenticated;

-- ============================================================
-- 4. DROP table orpheline cryptedmessage_userkeys_devices
-- ============================================================
-- Cette table a été renommée depuis cryptedmessage_userkeys et contient
-- encrypted_privkey + iv + kdf pour chaque user/device. Elle conserve une
-- policy "Users can read crypted public keys" FOR SELECT USING (true) qui
-- la rend lisible par tout utilisateur authentifié via PostgREST.
-- Les données ont déjà été migrées vers la nouvelle table cryptedmessage_userkeys
-- (avec seulement la pubkey). On peut donc DROP sans perte.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'cryptedmessage_userkeys_devices'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.cryptedmessage_userkeys_devices;
    END IF;
END;
$$;

DROP TABLE IF EXISTS public.cryptedmessage_userkeys_devices CASCADE;
