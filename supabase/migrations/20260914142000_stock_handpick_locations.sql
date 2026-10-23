-- ============================================================
-- Stock Handpick — modèle de localisation (plan de l'entrepôt)
-- Date: 2026-09-07
-- Dépend de : 20260914140000_stock_handpick_permissions.sql
--
-- Contexte
-- --------
-- Vision moyen terme : un plan 2D de l'entrepôt permettant de
-- connaître la position exacte de chaque balle. AUCUNE UI n'est
-- livrée ici — seul le modèle de données est posé, pour qu'un futur
-- éditeur se branche dessus sans migration lourde.
--
-- Deux tables et non quatre
-- -------------------------
-- L'énoncé métier nomme quatre niveaux (zone / allée / étagère /
-- emplacement). Les trois premiers sont STRUCTURELLEMENT identiques
-- (code, label, géométrie, parent, ordre) : quatre tables auraient
-- donné trois clones, trois jeux de policies, et surtout une
-- profondeur FIGÉE — le jour où un entrepôt n'a pas d'allées, le
-- modèle mentirait.
--
-- On sépare donc sur ce qui compte réellement :
--   • zones_handpick        = conteneurs, arbre libre auto-référencé
--   • emplacements_handpick = FEUILLES, seules cibles adressables
--
-- Une balle a une adresse, et cette adresse est forcément une
-- feuille : c'est la FK balles_handpick.emplacement_id qui l'impose
-- (migration 20260914143000). Avec une table unique, rien n'aurait
-- empêché de rattacher une balle à une zone entière.
--
-- Un canvas 2D rend des rectangles imbriqués, pas des « niveaux » :
-- l'arbre est exactement ce qu'il consomme.
--
-- Mapping permKey → policy (les 2 tables) :
--   SELECT → stock_handpick.view          (l'Inventaire affiche
--            l'emplacement d'une balle ; ne pas restreindre plus)
--   INSERT → stock_handpick.plan.create
--   UPDATE → stock_handpick.plan.update
--   DELETE → stock_handpick.plan.delete
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Conteneurs du plan ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zones_handpick (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id  UUID        REFERENCES public.zones_handpick(id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL,
    -- Code relatif au parent : 'A', '01', '3'. Le chemin complet
    -- (« A · 01 · 3 ») se calcule côté client depuis l'arbre déjà chargé —
    -- pas de colonne dénormalisée à recalculer sur toute la descendance
    -- à chaque renommage.
    code       TEXT        NOT NULL,
    label      TEXT,

    -- Géométrie du futur éditeur 2D, relative au parent.
    -- NULL = « pas encore positionné ». Un DEFAULT 0 aurait empilé tous
    -- les rectangles en (0,0) le jour de l'éditeur ; NULL est un état que
    -- l'UI saura présenter dans une palette « à placer ».
    pos_x      NUMERIC(10,2),
    pos_y      NUMERIC(10,2),
    width      NUMERIC(10,2),
    height     NUMERIC(10,2),
    rotation   NUMERIC(6,2) NOT NULL DEFAULT 0,
    color      TEXT,

    sort_order INTEGER     NOT NULL DEFAULT 0,
    is_active  BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT zones_handpick_kind_valid
        CHECK (kind IN ('zone', 'allee', 'etagere')),
    CONSTRAINT zones_handpick_code_not_blank
        CHECK (btrim(code) <> ''),
    -- Une zone est toujours racine…
    CONSTRAINT zones_handpick_zone_is_root
        CHECK (kind <> 'zone' OR parent_id IS NULL),
    -- …et tout ce qui n'est pas une zone a un parent.
    CONSTRAINT zones_handpick_child_has_parent
        CHECK (kind = 'zone' OR parent_id IS NOT NULL),
    CONSTRAINT zones_handpick_no_self_parent
        CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT zones_handpick_width_positive
        CHECK (width IS NULL OR width > 0),
    CONSTRAINT zones_handpick_height_positive
        CHECK (height IS NULL OR height > 0),
    CONSTRAINT zones_handpick_color_hex
        CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

COMMENT ON TABLE public.zones_handpick IS
    'Conteneurs du plan de l''entrepôt handpick : zones, allées ET étagères, '
    'distinguées par la colonne `kind` et organisées en arbre via parent_id. '
    'Le nom retenu est celui du vocabulaire métier ; les feuilles adressables '
    'vivent dans emplacements_handpick.';

COMMENT ON COLUMN public.zones_handpick.pos_x IS
    'Coordonnée relative au parent, en unités de plan. NULL = pas encore placé.';

-- Deux allées « 01 » sous la même zone, ou deux zones racine « A » :
-- impossible. COALESCE plutôt que NULLS NOT DISTINCT (PG 15+) pour ne
-- dépendre d'aucune version d'instance.
CREATE UNIQUE INDEX IF NOT EXISTS uq_zones_handpick_parent_code
    ON public.zones_handpick (
        COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
        lower(btrim(code))
    );

CREATE INDEX IF NOT EXISTS idx_zones_handpick_parent
    ON public.zones_handpick (parent_id, sort_order);

DROP TRIGGER IF EXISTS set_zones_handpick_updated_at ON public.zones_handpick;
CREATE TRIGGER set_zones_handpick_updated_at
    BEFORE UPDATE ON public.zones_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. Cohérence de l'arbre ────────────────────────────────────────────
-- Deux invariants qu'un CHECK ne peut pas exprimer :
--   a) le `kind` du parent doit être d'un niveau supérieur. Hiérarchie
--      SOUPLE : une étagère peut pendre d'une zone directement, sans allée
--      intermédiaire — c'est la raison d'être de l'arbre.
--   b) pas de cycle. Un CHECK ne voit pas A→B puis B→A ; sans ce garde,
--      le moindre WITH RECURSIVE de lecture boucle à l'infini.

CREATE OR REPLACE FUNCTION public.zones_handpick_check_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    parent_kind TEXT;
    cycle_found BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT z.kind INTO parent_kind
    FROM public.zones_handpick z
    WHERE z.id = NEW.parent_id;

    IF parent_kind IS NULL THEN
        RAISE EXCEPTION 'Zone parente % introuvable', NEW.parent_id;
    END IF;

    -- (a) niveaux autorisés
    IF NEW.kind = 'allee' AND parent_kind <> 'zone' THEN
        RAISE EXCEPTION 'Une allée doit être rattachée à une zone (parent: %)', parent_kind;
    END IF;

    IF NEW.kind = 'etagere' AND parent_kind NOT IN ('zone', 'allee') THEN
        RAISE EXCEPTION 'Une étagère doit être rattachée à une zone ou une allée (parent: %)', parent_kind;
    END IF;

    -- (b) anti-cycle : le nouveau parent ne doit pas être un descendant.
    -- Seul un UPDATE peut créer un cycle (à l'INSERT, la ligne n'a pas
    -- encore de descendance).
    IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        WITH RECURSIVE descendants AS (
            SELECT z.id
            FROM public.zones_handpick z
            WHERE z.parent_id = NEW.id
            UNION ALL
            SELECT z.id
            FROM public.zones_handpick z
            JOIN descendants d ON z.parent_id = d.id
        )
        SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.parent_id)
        INTO cycle_found;

        IF cycle_found THEN
            RAISE EXCEPTION 'Cycle détecté : la zone % ne peut pas être rattachée à son propre descendant %',
                NEW.id, NEW.parent_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zones_handpick_check_hierarchy ON public.zones_handpick;
CREATE TRIGGER zones_handpick_check_hierarchy
    BEFORE INSERT OR UPDATE ON public.zones_handpick
    FOR EACH ROW EXECUTE FUNCTION public.zones_handpick_check_hierarchy();

-- ─── 3. Emplacements (feuilles adressables) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.emplacements_handpick (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- RESTRICT et non CASCADE : combiné au CASCADE de l'auto-FK de
    -- zones_handpick, supprimer une zone tente de cascader sur ses
    -- allées/étagères puis ÉCHOUE s'il reste un emplacement. On ne détruit
    -- pas silencieusement l'adressage d'un entrepôt ; le nettoyage passe
    -- par is_active = false.
    zone_id    UUID        NOT NULL
        REFERENCES public.zones_handpick(id) ON DELETE RESTRICT,
    code       TEXT        NOT NULL,
    label      TEXT,

    pos_x      NUMERIC(10,2),
    pos_y      NUMERIC(10,2),
    width      NUMERIC(10,2),
    height     NUMERIC(10,2),

    -- Nombre de balles maximum. Informatif en V1 : aucune contrainte ne
    -- l'impose (une saisie terrain doit pouvoir dépasser puis corriger).
    capacity   INTEGER,
    is_active  BOOLEAN     NOT NULL DEFAULT true,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT emplacements_handpick_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT emplacements_handpick_capacity_positive
        CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT emplacements_handpick_width_positive
        CHECK (width IS NULL OR width > 0),
    CONSTRAINT emplacements_handpick_height_positive
        CHECK (height IS NULL OR height > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emplacements_handpick_zone_code
    ON public.emplacements_handpick (zone_id, lower(btrim(code)));

CREATE INDEX IF NOT EXISTS idx_emplacements_handpick_zone
    ON public.emplacements_handpick (zone_id);

DROP TRIGGER IF EXISTS set_emplacements_handpick_updated_at ON public.emplacements_handpick;
CREATE TRIGGER set_emplacements_handpick_updated_at
    BEFORE UPDATE ON public.emplacements_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 4. RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.zones_handpick        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emplacements_handpick ENABLE ROW LEVEL SECURITY;

-- zones_handpick

DROP POLICY IF EXISTS "zones_handpick_select" ON public.zones_handpick;
CREATE POLICY "zones_handpick_select" ON public.zones_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "zones_handpick_insert" ON public.zones_handpick;
CREATE POLICY "zones_handpick_insert" ON public.zones_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.plan.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "zones_handpick_update" ON public.zones_handpick;
CREATE POLICY "zones_handpick_update" ON public.zones_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.plan.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.plan.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "zones_handpick_delete" ON public.zones_handpick;
CREATE POLICY "zones_handpick_delete" ON public.zones_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.plan.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- emplacements_handpick

DROP POLICY IF EXISTS "emplacements_handpick_select" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_select" ON public.emplacements_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "emplacements_handpick_insert" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_insert" ON public.emplacements_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.plan.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "emplacements_handpick_update" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_update" ON public.emplacements_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.plan.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.plan.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "emplacements_handpick_delete" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_delete" ON public.emplacements_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.plan.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
