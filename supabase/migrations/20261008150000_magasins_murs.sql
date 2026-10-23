-- Magasins : murs et cloisons intérieurs, tracés point par point.
-- Dépend de 20261008110000_magasins_etages (et de son correctif dans
-- 20261008130000_magasins_escaliers). Idempotent.
--
-- Un mur est une ligne brisée [[x, y], …] en mètres (au moins deux points ;
-- un mur fermé répète son premier point à la fin), avec une épaisseur et une
-- hauteur. Rien ne s'y range : ni zone ni équipement.

CREATE TABLE IF NOT EXISTS public.murs_magasin (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id  UUID          NOT NULL REFERENCES public.magasins(id) ON DELETE CASCADE,
    etage_id    UUID          NOT NULL REFERENCES public.etages_magasin(id) ON DELETE CASCADE,
    points      JSONB         NOT NULL,
    -- 15 cm : cloison courante de boutique.
    epaisseur   NUMERIC(4,2)  NOT NULL DEFAULT 0.15,
    hauteur     NUMERIC(4,2)  NOT NULL DEFAULT 2.5,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by  UUID          REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    CONSTRAINT murs_magasin_points_polyline
        CHECK (jsonb_typeof(points) = 'array' AND jsonb_array_length(points) >= 2),
    CONSTRAINT murs_magasin_epaisseur_valid CHECK (epaisseur > 0 AND epaisseur <= 1),
    CONSTRAINT murs_magasin_hauteur_valid CHECK (hauteur > 0 AND hauteur <= 10)
);

CREATE INDEX IF NOT EXISTS idx_murs_magasin_etage ON public.murs_magasin (etage_id);
CREATE INDEX IF NOT EXISTS idx_murs_magasin_magasin ON public.murs_magasin (magasin_id);

DROP TRIGGER IF EXISTS set_murs_magasin_updated_at ON public.murs_magasin;
CREATE TRIGGER set_murs_magasin_updated_at
    BEFORE UPDATE ON public.murs_magasin
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- L'étage doit appartenir au même magasin (même contrôle que zones et équipements).
DROP TRIGGER IF EXISTS murs_magasin_check_etage ON public.murs_magasin;
CREATE TRIGGER murs_magasin_check_etage
    BEFORE INSERT OR UPDATE ON public.murs_magasin
    FOR EACH ROW EXECUTE FUNCTION public.magasin_check_etage();

ALTER TABLE public.murs_magasin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "murs_magasin_select" ON public.murs_magasin;
CREATE POLICY "murs_magasin_select" ON public.murs_magasin FOR SELECT TO authenticated
    USING ((SELECT has_permission('magasin.view'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "murs_magasin_insert" ON public.murs_magasin;
CREATE POLICY "murs_magasin_insert" ON public.murs_magasin FOR INSERT TO authenticated
    WITH CHECK ((SELECT has_permission('magasin.create'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "murs_magasin_update" ON public.murs_magasin;
CREATE POLICY "murs_magasin_update" ON public.murs_magasin FOR UPDATE TO authenticated
    USING ((SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()))
    WITH CHECK ((SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "murs_magasin_delete" ON public.murs_magasin;
CREATE POLICY "murs_magasin_delete" ON public.murs_magasin FOR DELETE TO authenticated
    USING ((SELECT has_permission('magasin.delete'::text)) AND (SELECT auth_session_is_aal2()));

NOTIFY pgrst, 'reload schema';
