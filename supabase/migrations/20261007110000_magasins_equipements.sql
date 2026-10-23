-- Magasins : équipements du plan (caisses, portes d'entrée et de sortie).
-- Dépend de 20261007100000_magasins. Ni zone ni emplacement : rien ne s'y
-- range, ils se placent seulement sur le plan. Mêmes droits que le reste
-- du module. Idempotent.

CREATE TABLE IF NOT EXISTS public.equipements_magasin (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id  UUID        NOT NULL REFERENCES public.magasins(id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL,
    code        TEXT        NOT NULL,
    label       TEXT,
    pos_x       NUMERIC(10,2),
    pos_y       NUMERIC(10,2),
    width       NUMERIC(10,2),
    height      NUMERIC(10,2),
    rotation    NUMERIC(6,2) NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    CONSTRAINT equipements_magasin_kind_valid
        CHECK (kind IN ('caisse', 'entree', 'sortie', 'entree_sortie')),
    CONSTRAINT equipements_magasin_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT equipements_magasin_width_positive CHECK (width IS NULL OR width > 0),
    CONSTRAINT equipements_magasin_height_positive CHECK (height IS NULL OR height > 0)
);

CREATE INDEX IF NOT EXISTS idx_equipements_magasin_magasin
    ON public.equipements_magasin (magasin_id);

DROP TRIGGER IF EXISTS set_equipements_magasin_updated_at ON public.equipements_magasin;
CREATE TRIGGER set_equipements_magasin_updated_at
    BEFORE UPDATE ON public.equipements_magasin
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.equipements_magasin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipements_magasin_select" ON public.equipements_magasin;
CREATE POLICY "equipements_magasin_select" ON public.equipements_magasin FOR SELECT TO authenticated
    USING ((SELECT has_permission('magasin.view'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS "equipements_magasin_insert" ON public.equipements_magasin;
CREATE POLICY "equipements_magasin_insert" ON public.equipements_magasin FOR INSERT TO authenticated
    WITH CHECK ((SELECT has_permission('magasin.create'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS "equipements_magasin_update" ON public.equipements_magasin;
CREATE POLICY "equipements_magasin_update" ON public.equipements_magasin FOR UPDATE TO authenticated
    USING ((SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()))
    WITH CHECK ((SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS "equipements_magasin_delete" ON public.equipements_magasin;
CREATE POLICY "equipements_magasin_delete" ON public.equipements_magasin FOR DELETE TO authenticated
    USING ((SELECT has_permission('magasin.delete'::text)) AND (SELECT auth_session_is_aal2()));

NOTIFY pgrst, 'reload schema';
