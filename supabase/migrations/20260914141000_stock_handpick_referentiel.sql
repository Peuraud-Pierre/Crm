-- ============================================================
-- Stock Handpick — référentiel : fournisseurs, catégories,
-- et la liaison many-to-many entre les deux.
-- Date: 2026-09-07
-- Dépend de : 20260914140000_stock_handpick_permissions.sql
--
-- Contexte
-- --------
-- Référentiel PROPRE au stock handpick, volontairement VIDE au
-- départ : aucune copie de fournisseur_gestion / categories_gestion.
-- Les deux stocks n'ont ni les mêmes fournisseurs ni la même
-- granularité de catégories ; les lier aurait recréé le couplage
-- que l'isolation cherche à éviter.
--
-- Nouveauté par rapport au stock principal : la table de liaison
-- fournisseurs_categories_handpick. Un fournisseur ne propose qu'un
-- sous-ensemble de catégories ; les formulaires de saisie s'en
-- servent pour ne présenter que les catégories réellement
-- disponibles une fois le fournisseur choisi.
--
-- Mapping permKey → policy (les 3 tables) :
--   SELECT → stock_handpick.view              (voir §4)
--   INSERT → stock_handpick.settings.create
--   UPDATE → stock_handpick.settings.update
--   DELETE → stock_handpick.settings.delete
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Fournisseurs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fournisseurs_handpick (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT        NOT NULL,
    siege_localisation TEXT,
    -- Code court d'affichage (miroir de fournisseur_gestion.tag).
    tag                TEXT,
    notes              TEXT,
    -- Désactivation plutôt que suppression : les FK des balles sont en
    -- ON DELETE RESTRICT, un fournisseur utilisé ne peut pas être supprimé.
    is_active          BOOLEAN     NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- profiles(user_id) et non auth.users : cf.
    -- 20260831110000_repoint_auth_users_fks_to_profiles.sql
    created_by         UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT fournisseurs_handpick_name_not_blank CHECK (btrim(name) <> '')
);

-- fournisseur_gestion.name est nullable (table créée au dashboard, hors
-- migrations) et sans contrainte d'unicité. On corrige ici.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fournisseurs_handpick_name
    ON public.fournisseurs_handpick (lower(btrim(name)));

-- Index partiel : les selects de formulaire ne chargent que les actifs.
CREATE INDEX IF NOT EXISTS idx_fournisseurs_handpick_active
    ON public.fournisseurs_handpick (is_active) WHERE is_active;

DROP TRIGGER IF EXISTS set_fournisseurs_handpick_updated_at ON public.fournisseurs_handpick;
CREATE TRIGGER set_fournisseurs_handpick_updated_at
    BEFORE UPDATE ON public.fournisseurs_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. Catégories ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories_handpick (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    tag         TEXT,
    -- Prix au kilo. NUMERIC et non float : valeur monétaire.
    unit_price  NUMERIC(12,4),
    -- Poids unitaire. Nommé `unit_weight` en base ET en TypeScript — le stock
    -- principal traîne trois noms pour cette donnée (colonne unit_weight,
    -- champ BalleCategory.unit_weight, alias poids_unitaire dans la jointure
    -- de balle.types.ts). Ne pas reproduire.
    unit_weight NUMERIC(12,3),
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT categories_handpick_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT categories_handpick_unit_price_positive
        CHECK (unit_price IS NULL OR unit_price >= 0),
    CONSTRAINT categories_handpick_unit_weight_positive
        CHECK (unit_weight IS NULL OR unit_weight > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_handpick_name
    ON public.categories_handpick (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_categories_handpick_active
    ON public.categories_handpick (is_active) WHERE is_active;

DROP TRIGGER IF EXISTS set_categories_handpick_updated_at ON public.categories_handpick;
CREATE TRIGGER set_categories_handpick_updated_at
    BEFORE UPDATE ON public.categories_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. Liaison fournisseur ↔ catégorie ─────────────────────────────────
-- Table de liens pure, sans donnée métier propre : CASCADE des deux côtés.
-- Supprimer un fournisseur ne supprime que SES liens, jamais les catégories.

CREATE TABLE IF NOT EXISTS public.fournisseurs_categories_handpick (
    fournisseur_id UUID        NOT NULL
        REFERENCES public.fournisseurs_handpick(id) ON DELETE CASCADE,
    category_id    UUID        NOT NULL
        REFERENCES public.categories_handpick(id)   ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by     UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    -- La PK sert directement le cas d'usage du formulaire :
    -- « quelles catégories pour ce fournisseur ? ».
    PRIMARY KEY (fournisseur_id, category_id)
);

-- Sens inverse — « quels fournisseurs proposent cette catégorie ? »,
-- affiché en lecture seule dans l'onglet Paramètres côté catégorie.
CREATE INDEX IF NOT EXISTS idx_fournisseurs_categories_handpick_category
    ON public.fournisseurs_categories_handpick (category_id);

COMMENT ON TABLE public.fournisseurs_categories_handpick IS
    'Catégories proposées par chaque fournisseur du stock handpick. Restreint '
    'les choix des formulaires de saisie de balle ; la cohérence est vérifiée '
    'en base par le trigger balles_handpick_check_fournisseur_category.';

-- ─── 4. RLS ─────────────────────────────────────────────────────────────
-- Le SELECT est gaté sur `stock_handpick.view`, PAS sur `settings.view` :
-- les selects fournisseur/catégorie sont utilisés dans l'Inventaire et le
-- Flux. Les adosser à la permission de l'onglet Paramètres viderait
-- silencieusement les listes déroulantes pour qui n'y a pas accès —
-- l'arbitrage exact déjà documenté dans 20260818120000 pour
-- categories_gestion (branche crm.view).
--
-- Toutes les policies exigent une session AAL2, comme le reste de la base.
-- CREATE POLICY n'a pas de IF NOT EXISTS : DROP systématique avant.

ALTER TABLE public.fournisseurs_handpick            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories_handpick              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs_categories_handpick ENABLE ROW LEVEL SECURITY;

-- fournisseurs_handpick

DROP POLICY IF EXISTS "fournisseurs_handpick_select" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_select" ON public.fournisseurs_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseurs_handpick_insert" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_insert" ON public.fournisseurs_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.settings.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseurs_handpick_update" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_update" ON public.fournisseurs_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseurs_handpick_delete" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_delete" ON public.fournisseurs_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.settings.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- categories_handpick

DROP POLICY IF EXISTS "categories_handpick_select" ON public.categories_handpick;
CREATE POLICY "categories_handpick_select" ON public.categories_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "categories_handpick_insert" ON public.categories_handpick;
CREATE POLICY "categories_handpick_insert" ON public.categories_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.settings.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "categories_handpick_update" ON public.categories_handpick;
CREATE POLICY "categories_handpick_update" ON public.categories_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "categories_handpick_delete" ON public.categories_handpick;
CREATE POLICY "categories_handpick_delete" ON public.categories_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.settings.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- fournisseurs_categories_handpick

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_select" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_select" ON public.fournisseurs_categories_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_insert" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_insert" ON public.fournisseurs_categories_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.settings.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_update" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_update" ON public.fournisseurs_categories_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_delete" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_delete" ON public.fournisseurs_categories_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.settings.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
