-- ============================================================
-- Magasins — liste des magasins et plan de leurs emplacements
-- Date: 2026-10-07
--
-- Contexte
-- --------
-- Chaque magasin décrit son agencement : des zones (rayons, étagères…)
-- et des emplacements, dessinés sur un plan 2D/3D. Le modèle reprend
-- celui du stock handpick (20260914142000) — conteneurs en arbre +
-- feuilles adressables — mais en tables propres, rattachées à un
-- magasin : le plan du handpick décrit UN entrepôt, celui-ci en décrit
-- autant qu'il y a de magasins. Aucune marchandise n'y est rattachée
-- pour l'instant.
--
-- Géométrie
-- ---------
-- pos_x / pos_y / width / height en MÈTRES, ABSOLUS dans le repère du
-- magasin (origine coin haut-gauche, x → droite, y ↓ bas). Contrairement
-- au handpick (relatif au parent), l'éditeur déplace ainsi un élément
-- sans recalculer sa descendance. NULL = pas encore placé : l'élément
-- apparaît dans la palette « à placer » de l'éditeur.
--
-- Droits (4 tables) :
--   SELECT → magasin.view
--   INSERT → magasin.create
--   UPDATE → magasin.update
--   DELETE → magasin.delete
-- Comme pour le stock handpick, AUCUN droit n'est attribué ici : après
-- application, s'accorder `magasin.view` (et les autres) depuis
-- /administration. Toute la RLS exige une session MFA (aal2).
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 0. Permissions ─────────────────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'magasin'
FROM (VALUES
    ('magasin.view',   'Voir les magasins et leurs plans'),
    ('magasin.create', 'Créer un magasin, une zone ou un emplacement'),
    ('magasin.update', 'Modifier un magasin, son plan ou ses emplacements'),
    ('magasin.delete', 'Supprimer un magasin, une zone ou un emplacement')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- ─── 1. Magasins ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.magasins (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        NOT NULL,
    nom         TEXT        NOT NULL,
    adresse     TEXT,
    ville       TEXT,
    -- Emprise du plan, en mètres.
    largeur     NUMERIC(10,2) NOT NULL DEFAULT 20,
    profondeur  NUMERIC(10,2) NOT NULL DEFAULT 15,
    notes       TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT magasins_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT magasins_nom_not_blank CHECK (btrim(nom) <> ''),
    CONSTRAINT magasins_largeur_positive CHECK (largeur > 0),
    CONSTRAINT magasins_profondeur_positive CHECK (profondeur > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_magasins_code
    ON public.magasins (lower(btrim(code)));

DROP TRIGGER IF EXISTS set_magasins_updated_at ON public.magasins;
CREATE TRIGGER set_magasins_updated_at
    BEFORE UPDATE ON public.magasins
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. Zones (conteneurs, en arbre) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zones_magasin (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id  UUID        NOT NULL REFERENCES public.magasins(id) ON DELETE CASCADE,
    parent_id   UUID        REFERENCES public.zones_magasin(id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL,
    code        TEXT        NOT NULL,
    label       TEXT,
    pos_x       NUMERIC(10,2),
    pos_y       NUMERIC(10,2),
    width       NUMERIC(10,2),
    height      NUMERIC(10,2),
    rotation    NUMERIC(6,2) NOT NULL DEFAULT 0,
    color       TEXT,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT zones_magasin_kind_valid
        CHECK (kind IN ('zone', 'rayon', 'etagere')),
    CONSTRAINT zones_magasin_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT zones_magasin_zone_is_root CHECK (kind <> 'zone' OR parent_id IS NULL),
    CONSTRAINT zones_magasin_child_has_parent CHECK (kind = 'zone' OR parent_id IS NOT NULL),
    CONSTRAINT zones_magasin_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT zones_magasin_width_positive CHECK (width IS NULL OR width > 0),
    CONSTRAINT zones_magasin_height_positive CHECK (height IS NULL OR height > 0),
    CONSTRAINT zones_magasin_color_hex CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Deux zones racine « A » dans le même magasin, ou deux rayons « 01 »
-- sous la même zone : impossible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_zones_magasin_parent_code
    ON public.zones_magasin (
        magasin_id,
        COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
        lower(btrim(code))
    );

CREATE INDEX IF NOT EXISTS idx_zones_magasin_magasin
    ON public.zones_magasin (magasin_id, parent_id, sort_order);

DROP TRIGGER IF EXISTS set_zones_magasin_updated_at ON public.zones_magasin;
CREATE TRIGGER set_zones_magasin_updated_at
    BEFORE UPDATE ON public.zones_magasin
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invariants qu'un CHECK ne peut pas exprimer : niveau du parent, même
-- magasin que le parent, pas de cycle. Messages en français : le client
-- les affiche tels quels.
CREATE OR REPLACE FUNCTION public.zones_magasin_check_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    parent_kind    TEXT;
    parent_magasin UUID;
    cycle_found    BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT z.kind, z.magasin_id INTO parent_kind, parent_magasin
    FROM public.zones_magasin z
    WHERE z.id = NEW.parent_id;

    IF parent_kind IS NULL THEN
        RAISE EXCEPTION 'Zone parente introuvable';
    END IF;

    IF parent_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'La zone parente appartient à un autre magasin';
    END IF;

    IF NEW.kind = 'rayon' AND parent_kind <> 'zone' THEN
        RAISE EXCEPTION 'Un rayon doit être rattaché à une zone';
    END IF;

    IF NEW.kind = 'etagere' AND parent_kind NOT IN ('zone', 'rayon') THEN
        RAISE EXCEPTION 'Une étagère doit être rattachée à une zone ou à un rayon';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        WITH RECURSIVE descendants AS (
            SELECT z.id FROM public.zones_magasin z WHERE z.parent_id = NEW.id
            UNION ALL
            SELECT z.id FROM public.zones_magasin z JOIN descendants d ON z.parent_id = d.id
        )
        SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.parent_id)
        INTO cycle_found;

        IF cycle_found THEN
            RAISE EXCEPTION 'Une zone ne peut pas être rattachée à l''une de ses sous-zones';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zones_magasin_check_hierarchy ON public.zones_magasin;
CREATE TRIGGER zones_magasin_check_hierarchy
    BEFORE INSERT OR UPDATE ON public.zones_magasin
    FOR EACH ROW EXECUTE FUNCTION public.zones_magasin_check_hierarchy();

-- ─── 3. Emplacements (feuilles) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.emplacements_magasin (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Dénormalisé pour charger le plan d'un magasin en une requête ; le
    -- trigger ci-dessous garantit qu'il est celui de la zone.
    magasin_id  UUID        NOT NULL REFERENCES public.magasins(id) ON DELETE CASCADE,
    -- CASCADE et non RESTRICT (choix inverse du handpick) : rien n'est
    -- rangé dans un emplacement de magasin, supprimer une zone ne détruit
    -- aucune donnée hors du plan. L'interface annonce le nombre
    -- d'emplacements emportés avant de confirmer.
    zone_id     UUID        NOT NULL REFERENCES public.zones_magasin(id) ON DELETE CASCADE,
    code        TEXT        NOT NULL,
    label       TEXT,
    pos_x       NUMERIC(10,2),
    pos_y       NUMERIC(10,2),
    width       NUMERIC(10,2),
    height      NUMERIC(10,2),
    rotation    NUMERIC(6,2) NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT emplacements_magasin_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT emplacements_magasin_width_positive CHECK (width IS NULL OR width > 0),
    CONSTRAINT emplacements_magasin_height_positive CHECK (height IS NULL OR height > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emplacements_magasin_zone_code
    ON public.emplacements_magasin (zone_id, lower(btrim(code)));

CREATE INDEX IF NOT EXISTS idx_emplacements_magasin_magasin
    ON public.emplacements_magasin (magasin_id);

DROP TRIGGER IF EXISTS set_emplacements_magasin_updated_at ON public.emplacements_magasin;
CREATE TRIGGER set_emplacements_magasin_updated_at
    BEFORE UPDATE ON public.emplacements_magasin
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.emplacements_magasin_check_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    zone_magasin UUID;
BEGIN
    SELECT z.magasin_id INTO zone_magasin
    FROM public.zones_magasin z
    WHERE z.id = NEW.zone_id;

    IF zone_magasin IS NULL THEN
        RAISE EXCEPTION 'Zone introuvable';
    END IF;
    IF zone_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'La zone appartient à un autre magasin';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emplacements_magasin_check_zone ON public.emplacements_magasin;
CREATE TRIGGER emplacements_magasin_check_zone
    BEFORE INSERT OR UPDATE ON public.emplacements_magasin
    FOR EACH ROW EXECUTE FUNCTION public.emplacements_magasin_check_zone();

-- ─── 4. RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.magasins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magasins_select" ON public.magasins;
CREATE POLICY "magasins_select" ON public.magasins
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('magasin.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "magasins_insert" ON public.magasins;
CREATE POLICY "magasins_insert" ON public.magasins
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('magasin.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "magasins_update" ON public.magasins;
CREATE POLICY "magasins_update" ON public.magasins
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('magasin.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('magasin.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "magasins_delete" ON public.magasins;
CREATE POLICY "magasins_delete" ON public.magasins
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('magasin.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

ALTER TABLE public.zones_magasin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zones_magasin_select" ON public.zones_magasin;
CREATE POLICY "zones_magasin_select" ON public.zones_magasin
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('magasin.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "zones_magasin_insert" ON public.zones_magasin;
CREATE POLICY "zones_magasin_insert" ON public.zones_magasin
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('magasin.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "zones_magasin_update" ON public.zones_magasin;
CREATE POLICY "zones_magasin_update" ON public.zones_magasin
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('magasin.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('magasin.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "zones_magasin_delete" ON public.zones_magasin;
CREATE POLICY "zones_magasin_delete" ON public.zones_magasin
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('magasin.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

ALTER TABLE public.emplacements_magasin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emplacements_magasin_select" ON public.emplacements_magasin;
CREATE POLICY "emplacements_magasin_select" ON public.emplacements_magasin
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('magasin.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "emplacements_magasin_insert" ON public.emplacements_magasin;
CREATE POLICY "emplacements_magasin_insert" ON public.emplacements_magasin
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('magasin.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "emplacements_magasin_update" ON public.emplacements_magasin;
CREATE POLICY "emplacements_magasin_update" ON public.emplacements_magasin
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('magasin.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('magasin.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "emplacements_magasin_delete" ON public.emplacements_magasin;
CREATE POLICY "emplacements_magasin_delete" ON public.emplacements_magasin
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('magasin.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

NOTIFY pgrst, 'reload schema';
