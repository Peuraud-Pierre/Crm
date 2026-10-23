-- ============================================================
-- Stock Handpick — disposition du plan, modifiable depuis l'application
-- Date: 2026-09-17
-- Dépend de : 20260914140000 (permissions stock_handpick.plan.*)
--
-- La disposition de l'onglet Plan (racks, meubles, bureaux, portes,
-- colonnes, cloisons) était figée dans le code. Elle devient une donnée :
-- une ligne unique `id = 'default'` portant la disposition en JSON.
-- Tant qu'aucune ligne n'existe, l'application affiche sa disposition par
-- défaut (DEFAULT_FLOOR dans src/features/stock_handpick/utils/floorPlan.ts).
--
-- Le JSON ne porte que la GÉOMÉTRIE. Les emplacements adressables
-- (zones_handpick / emplacements_handpick) ne sont pas touchés : déplacer
-- ou retirer un rack du dessin ne déplace ni ne supprime aucune balle.
--
-- Droits :
--   SELECT          → stock_handpick.plan.view
--   INSERT / UPDATE → stock_handpick.plan.update
--   (pas de DELETE : « rétablir l'original » réenregistre la disposition
--   par défaut)
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plan_layout_handpick (
    id         TEXT        PRIMARY KEY DEFAULT 'default',
    layout     JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID        NULL REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    CONSTRAINT plan_layout_handpick_layout_object CHECK (jsonb_typeof(layout) = 'object')
);

COMMENT ON TABLE public.plan_layout_handpick IS
    'Disposition du plan de l''entrepôt handpick (onglet Plan), en JSON. '
    'Géométrie seule : les emplacements adressables restent dans '
    'zones_handpick / emplacements_handpick.';

-- Auteur et date posés par la base, jamais par le client.
CREATE OR REPLACE FUNCTION public.plan_layout_handpick_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_layout_handpick_stamp ON public.plan_layout_handpick;
CREATE TRIGGER plan_layout_handpick_stamp
    BEFORE INSERT OR UPDATE ON public.plan_layout_handpick
    FOR EACH ROW EXECUTE FUNCTION public.plan_layout_handpick_stamp();

ALTER TABLE public.plan_layout_handpick ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_layout_handpick_select" ON public.plan_layout_handpick;
CREATE POLICY "plan_layout_handpick_select" ON public.plan_layout_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.plan.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "plan_layout_handpick_insert" ON public.plan_layout_handpick;
CREATE POLICY "plan_layout_handpick_insert" ON public.plan_layout_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "plan_layout_handpick_update" ON public.plan_layout_handpick;
CREATE POLICY "plan_layout_handpick_update" ON public.plan_layout_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- Realtime : une disposition enregistrée apparaît chez les autres
-- utilisateurs sans rechargement. ADD TABLE n'a pas de IF NOT EXISTS.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'plan_layout_handpick'
       )
    THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_layout_handpick;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
