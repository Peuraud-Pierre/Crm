-- ============================================================
-- Ordre des sections de l'onglet CRM Analytics (par utilisateur)
-- Date: 2026-09-10
--
-- Contexte
-- --------
-- Le tableau de bord Analytics du CRM (Header/KPIs/Charts) devient
-- réordonnable par glisser-déposer. Même parti pris que
-- public.user_dashboard_layout (20260824104000) et
-- public.user_preferences (20260811160000) : une ligne par
-- utilisateur, absence de ligne = ordre par défaut valide.
--
-- Pas de gabarits par rôle/service ici (contrairement au dashboard) :
-- seulement 3 sections, YAGNI.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_crm_analytics_layout (
    user_id      uuid PRIMARY KEY
                     REFERENCES auth.users (id) ON DELETE CASCADE,
    section_order jsonb NOT NULL DEFAULT '["header","kpis","charts"]',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    -- Garde-fou minimal : la forme est un tableau. La validation fine
    -- (clés connues du registre de sections) appartient au front, qui
    -- seul connaît ce registre.
    CONSTRAINT user_crm_analytics_layout_shape CHECK (
        jsonb_typeof(section_order) = 'array'
    )
);

COMMENT ON TABLE public.user_crm_analytics_layout IS
    'Ordre des sections (Header/KPIs/Charts) de l''onglet CRM '
    'Analytics, propre à un utilisateur. Absence de ligne = ordre '
    'par défaut ["header","kpis","charts"].';

CREATE OR REPLACE FUNCTION public.crm_analytics_layout_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_crm_analytics_layout_set_updated_at
    ON public.user_crm_analytics_layout;
CREATE TRIGGER user_crm_analytics_layout_set_updated_at
    BEFORE UPDATE ON public.user_crm_analytics_layout
    FOR EACH ROW EXECUTE FUNCTION public.crm_analytics_layout_set_updated_at();

-- RLS : strictement personnel, calque de user_dashboard_layout. Aucune
-- permission applicative n'entre en jeu, un utilisateur ne lit et
-- n'écrit que sa propre ligne.

ALTER TABLE public.user_crm_analytics_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_crm_analytics_layout_select" ON public.user_crm_analytics_layout;
DROP POLICY IF EXISTS "user_crm_analytics_layout_insert" ON public.user_crm_analytics_layout;
DROP POLICY IF EXISTS "user_crm_analytics_layout_update" ON public.user_crm_analytics_layout;
DROP POLICY IF EXISTS "user_crm_analytics_layout_delete" ON public.user_crm_analytics_layout;

CREATE POLICY "user_crm_analytics_layout_select" ON public.user_crm_analytics_layout
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_crm_analytics_layout_insert" ON public.user_crm_analytics_layout
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_crm_analytics_layout_update" ON public.user_crm_analytics_layout
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_crm_analytics_layout_delete" ON public.user_crm_analytics_layout
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);
