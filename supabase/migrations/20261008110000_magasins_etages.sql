-- Magasins : étages, et contour libre de chaque étage.
-- Dépend de 20261007100000, 20261007110000 et 20261008100000. Idempotent.
--
-- Chaque magasin a au moins un étage. Les zones (et donc leurs emplacements)
-- et les équipements appartiennent à un étage ; le plan importé à décalquer
-- et le contour du plan aussi — chaque niveau a sa forme et son plan papier.
-- Les dimensions (largeur × profondeur) restent celles du magasin : c'est le
-- cadre commun dans lequel chaque étage dessine son contour.
--
-- Données existantes : un étage « RDC » (niveau 0) est créé dans chaque
-- magasin et reçoit ses zones, ses équipements et son plan importé.

-- ─── 1. Étages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.etages_magasin (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id       UUID        NOT NULL REFERENCES public.magasins(id) ON DELETE CASCADE,
    nom              TEXT        NOT NULL,
    -- 0 = rez-de-chaussée, 1 = 1er étage, -1 = sous-sol… ; ordre d'affichage.
    niveau           INTEGER     NOT NULL DEFAULT 0,
    -- Contour du plan : polygone [[x, y], …] en mètres, dans le cadre du
    -- magasin. NULL = le rectangle entier du magasin.
    contour          JSONB,
    fond_path        TEXT,
    fond_x           NUMERIC(10,2),
    fond_y           NUMERIC(10,2),
    fond_largeur     NUMERIC(10,2),
    fond_profondeur  NUMERIC(10,2),
    fond_opacite     NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    CONSTRAINT etages_magasin_nom_not_blank CHECK (btrim(nom) <> ''),
    CONSTRAINT etages_magasin_contour_polygon
        CHECK (contour IS NULL OR (jsonb_typeof(contour) = 'array' AND jsonb_array_length(contour) >= 3))
);

-- Un seul étage par niveau dans un magasin.
CREATE UNIQUE INDEX IF NOT EXISTS uq_etages_magasin_niveau ON public.etages_magasin (magasin_id, niveau);

DROP TRIGGER IF EXISTS set_etages_magasin_updated_at ON public.etages_magasin;
CREATE TRIGGER set_etages_magasin_updated_at
    BEFORE UPDATE ON public.etages_magasin
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.etages_magasin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etages_magasin_select" ON public.etages_magasin;
CREATE POLICY "etages_magasin_select" ON public.etages_magasin FOR SELECT TO authenticated
    USING ((SELECT has_permission('magasin.view'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "etages_magasin_insert" ON public.etages_magasin;
CREATE POLICY "etages_magasin_insert" ON public.etages_magasin FOR INSERT TO authenticated
    WITH CHECK ((SELECT has_permission('magasin.create'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "etages_magasin_update" ON public.etages_magasin;
CREATE POLICY "etages_magasin_update" ON public.etages_magasin FOR UPDATE TO authenticated
    USING ((SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()))
    WITH CHECK ((SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "etages_magasin_delete" ON public.etages_magasin;
CREATE POLICY "etages_magasin_delete" ON public.etages_magasin FOR DELETE TO authenticated
    USING ((SELECT has_permission('magasin.delete'::text)) AND (SELECT auth_session_is_aal2()));

-- ─── 2. Un « RDC » par magasin existant, qui reprend son plan importé ───
INSERT INTO public.etages_magasin (magasin_id, nom, niveau)
SELECT m.id, 'RDC', 0
FROM public.magasins m
WHERE NOT EXISTS (SELECT 1 FROM public.etages_magasin e WHERE e.magasin_id = m.id);

DO $$
BEGIN
    -- Le plan importé vivait sur le magasin (20261008100000) : il passe sur
    -- l'étage de niveau 0, puis les colonnes du magasin sont retirées.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'magasins' AND column_name = 'fond_path') THEN
        UPDATE public.etages_magasin e
        SET fond_path = m.fond_path, fond_x = m.fond_x, fond_y = m.fond_y,
            fond_largeur = m.fond_largeur, fond_profondeur = m.fond_profondeur,
            fond_opacite = m.fond_opacite
        FROM public.magasins m
        WHERE e.magasin_id = m.id AND e.niveau = 0 AND m.fond_path IS NOT NULL AND e.fond_path IS NULL;

        ALTER TABLE public.magasins
            DROP COLUMN IF EXISTS fond_path,
            DROP COLUMN IF EXISTS fond_x,
            DROP COLUMN IF EXISTS fond_y,
            DROP COLUMN IF EXISTS fond_largeur,
            DROP COLUMN IF EXISTS fond_profondeur,
            DROP COLUMN IF EXISTS fond_opacite;
    END IF;
END;
$$;

-- ─── 3. Zones et équipements rattachés à un étage ───────────────────────
ALTER TABLE public.zones_magasin
    ADD COLUMN IF NOT EXISTS etage_id UUID REFERENCES public.etages_magasin(id) ON DELETE CASCADE;
ALTER TABLE public.equipements_magasin
    ADD COLUMN IF NOT EXISTS etage_id UUID REFERENCES public.etages_magasin(id) ON DELETE CASCADE;

UPDATE public.zones_magasin z
SET etage_id = (SELECT e.id FROM public.etages_magasin e WHERE e.magasin_id = z.magasin_id ORDER BY e.niveau LIMIT 1)
WHERE z.etage_id IS NULL;
UPDATE public.equipements_magasin q
SET etage_id = (SELECT e.id FROM public.etages_magasin e WHERE e.magasin_id = q.magasin_id ORDER BY e.niveau LIMIT 1)
WHERE q.etage_id IS NULL;

ALTER TABLE public.zones_magasin ALTER COLUMN etage_id SET NOT NULL;
ALTER TABLE public.equipements_magasin ALTER COLUMN etage_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zones_magasin_etage ON public.zones_magasin (etage_id);
CREATE INDEX IF NOT EXISTS idx_equipements_magasin_etage ON public.equipements_magasin (etage_id);

-- Les codes racine sont uniques par étage (deux étages peuvent avoir leur zone « A »).
DROP INDEX IF EXISTS public.uq_zones_magasin_parent_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_zones_magasin_etage_parent_code
    ON public.zones_magasin (
        etage_id,
        COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
        lower(btrim(code))
    );

-- ─── 4. Cohérence étage ↔ magasin ↔ parent ──────────────────────────────
CREATE OR REPLACE FUNCTION public.magasin_check_etage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    etage_magasin UUID;
    parent_etage  UUID;
BEGIN
    SELECT e.magasin_id INTO etage_magasin FROM public.etages_magasin e WHERE e.id = NEW.etage_id;
    IF etage_magasin IS NULL THEN
        RAISE EXCEPTION 'Étage introuvable';
    END IF;
    IF etage_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'L''étage appartient à un autre magasin';
    END IF;

    IF TG_TABLE_NAME = 'zones_magasin' THEN
        -- Bloc imbriqué et non `AND` : PL/pgSQL résout NEW.parent_id avant
        -- d'évaluer la condition, et les équipements n'ont pas cette colonne.
        IF NEW.parent_id IS NOT NULL THEN
            SELECT z.etage_id INTO parent_etage FROM public.zones_magasin z WHERE z.id = NEW.parent_id;
            IF parent_etage IS DISTINCT FROM NEW.etage_id THEN
                RAISE EXCEPTION 'La zone parente est sur un autre étage';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zones_magasin_check_etage ON public.zones_magasin;
CREATE TRIGGER zones_magasin_check_etage
    BEFORE INSERT OR UPDATE ON public.zones_magasin
    FOR EACH ROW EXECUTE FUNCTION public.magasin_check_etage();

DROP TRIGGER IF EXISTS equipements_magasin_check_etage ON public.equipements_magasin;
CREATE TRIGGER equipements_magasin_check_etage
    BEFORE INSERT OR UPDATE ON public.equipements_magasin
    FOR EACH ROW EXECUTE FUNCTION public.magasin_check_etage();

-- ─── 5. Tout nouveau magasin naît avec son RDC ─────────────────────────
CREATE OR REPLACE FUNCTION public.magasins_create_rdc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.etages_magasin (magasin_id, nom, niveau, created_by)
    VALUES (NEW.id, 'RDC', 0, NEW.created_by);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS magasins_create_rdc ON public.magasins;
CREATE TRIGGER magasins_create_rdc
    AFTER INSERT ON public.magasins
    FOR EACH ROW EXECUTE FUNCTION public.magasins_create_rdc();

NOTIFY pgrst, 'reload schema';
