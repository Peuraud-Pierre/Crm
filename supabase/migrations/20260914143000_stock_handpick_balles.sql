-- ============================================================
-- Stock Handpick — table des balles
-- Date: 2026-09-07
-- Dépend de : 20260914141000 (référentiel), 20260914142000 (plan)
--
-- Contexte
-- --------
-- Reprise du schéma de balles_gestion (cf.
-- src/features/stock/types/balle.types.ts) à trois retraits près,
-- volontaires :
--
--   • pas de `bin`         — le code BIN du stock principal est dérivé
--     d'un DIN de livraison (Type+Fournisseur+Loc+Date + index + tag
--     catégorie). Ce raisonnement ne s'applique pas ici.
--   • pas de `din`, pas de `delivery_id` — il n'y a pas d'entité
--     livraison dans ce module ; le regroupement d'un arrivage passe
--     par mouvements_handpick.batch_id (migration 20260914144000).
--   • aucune référence lisible de remplacement — décision explicite :
--     l'identité d'une balle est son UUID, affiché tronqué. Réintroduire
--     un code saisi aurait ramené la validation, les doublons 23505 et
--     l'UX de saisie que le retrait du BIN visait à supprimer.
--
-- Une passe métier viendra plus tard avec des cas d'usage réels. En V1,
-- une balle n'a QUE les actions de base : création, modification,
-- suppression. Aucune action « vivante » (split, transfert, tri…).
--
-- Mapping permKey → policy :
--   SELECT → stock_handpick.inventaire.view
--   INSERT → stock_handpick.inventaire.create
--   UPDATE → stock_handpick.inventaire.update
--   DELETE → stock_handpick.inventaire.delete
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.balles_handpick (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Contenu ──────────────────────────────────────────────────────
    packing         NUMERIC(12,3),
    packing_mode    TEXT        NOT NULL DEFAULT 'kilos',
    import_date     TIMESTAMPTZ,
    -- RESTRICT : une balle témoigne d'un achat, on ne laisse pas la
    -- suppression d'un fournisseur effacer ou orpheliner cette trace.
    -- Le référentiel se désactive (is_active), il ne se supprime pas.
    fournisseur_id  UUID        REFERENCES public.fournisseurs_handpick(id) ON DELETE RESTRICT,
    category_id     UUID        REFERENCES public.categories_handpick(id)   ON DELETE RESTRICT,
    -- Libellé brut de la packing list, tel que reçu du fournisseur.
    raw_name        TEXT,
    provenance      TEXT,

    -- ── Filiation ────────────────────────────────────────────────────
    is_original     BOOLEAN     NOT NULL DEFAULT true,
    -- SET NULL et jamais CASCADE : supprimer une balle mère ne doit pas
    -- emporter ses filles, qui existent physiquement.
    parent_balle_id UUID        REFERENCES public.balles_handpick(id) ON DELETE SET NULL,

    -- ── État ─────────────────────────────────────────────────────────
    status          TEXT        NOT NULL DEFAULT 'stocked',
    location        TEXT,
    type            TEXT,

    -- ── Adresse physique (plan de l'entrepôt) ────────────────────────
    emplacement_id  UUID        REFERENCES public.emplacements_handpick(id) ON DELETE SET NULL,
    placed_at       TIMESTAMPTZ,

    -- ── Valorisation ─────────────────────────────────────────────────
    purchase_price  NUMERIC(12,2),
    treatment_cost  NUMERIC(12,2),
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    -- Jeu repris à l'identique du stock principal. Certaines valeurs ont
    -- peu de sens ici : l'UI n'en expose qu'un sous-ensemble via
    -- constants.ts. Resserrer le CHECK plus tard est un simple
    -- ALTER TABLE, définir un cycle de vie à l'aveugle ne l'est pas.
    CONSTRAINT balles_handpick_status_valid CHECK (status IN (
        'stocked', 'used', 'exported', 'transfered',
        'imported', 'delivered', 'shipped'
    )),
    -- Jeu RESSERRÉ et propre au handpick (le stock principal a
    -- import_bay / export_bay / tri_gros / tri_retail, liés aux
    -- conteneurs).
    CONSTRAINT balles_handpick_location_valid CHECK (location IS NULL OR location IN (
        'warehouse', 'reception', 'tri', 'handpick', 'expedition', 'out'
    )),
    CONSTRAINT balles_handpick_type_valid CHECK (type IS NULL OR type IN (
        'push', 'bags', 'balle', 'palette', 'other'
    )),
    CONSTRAINT balles_handpick_packing_mode_valid
        CHECK (packing_mode IN ('kilos', 'pieces')),
    CONSTRAINT balles_handpick_packing_positive
        CHECK (packing IS NULL OR packing >= 0),
    CONSTRAINT balles_handpick_purchase_price_positive
        CHECK (purchase_price IS NULL OR purchase_price >= 0),
    CONSTRAINT balles_handpick_treatment_cost_positive
        CHECK (treatment_cost IS NULL OR treatment_cost >= 0),
    CONSTRAINT balles_handpick_no_self_parent
        CHECK (parent_balle_id IS NULL OR parent_balle_id <> id),
    -- Une balle d'origine ne descend de personne.
    CONSTRAINT balles_handpick_original_has_no_parent
        CHECK (is_original = false OR parent_balle_id IS NULL)
);

COMMENT ON COLUMN public.balles_handpick.location IS
    'Macro-état physique de la balle. Invariant NON contraint en base : '
    'emplacement_id IS NOT NULL implique location = ''warehouse'' — l''inverse '
    'est faux (une balle peut être en entrepôt sans adresse assignée). Un CHECK '
    'croisé forcerait tous les formulaires à écrire les deux colonnes ensemble ; '
    'c''est la couche service qui pose l''invariant (setEmplacement).';

COMMENT ON COLUMN public.balles_handpick.emplacement_id IS
    'Adresse fine dans le plan de l''entrepôt. NULL = pas encore rangée. '
    'La FK cible une FEUILLE (emplacements_handpick), jamais une zone.';

-- ─── Index ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_balles_handpick_status
    ON public.balles_handpick (status);

-- Index partiel : c'est LA requête du board Inventaire.
CREATE INDEX IF NOT EXISTS idx_balles_handpick_stocked
    ON public.balles_handpick (created_at DESC) WHERE status = 'stocked';

-- Occupation d'un emplacement (futur plan 2D).
CREATE INDEX IF NOT EXISTS idx_balles_handpick_emplacement
    ON public.balles_handpick (emplacement_id);

CREATE INDEX IF NOT EXISTS idx_balles_handpick_fournisseur
    ON public.balles_handpick (fournisseur_id);

CREATE INDEX IF NOT EXISTS idx_balles_handpick_category
    ON public.balles_handpick (category_id);

CREATE INDEX IF NOT EXISTS idx_balles_handpick_import_date
    ON public.balles_handpick (import_date DESC);

CREATE INDEX IF NOT EXISTS idx_balles_handpick_parent
    ON public.balles_handpick (parent_balle_id) WHERE parent_balle_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_balles_handpick_updated_at ON public.balles_handpick;
CREATE TRIGGER set_balles_handpick_updated_at
    BEFORE UPDATE ON public.balles_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Cohérence fournisseur ↔ catégorie ──────────────────────────────────
-- La catégorie d'une balle doit être proposée par son fournisseur. La règle
-- porte sur une autre table : impossible en CHECK.
--
-- Pourquoi un trigger plutôt qu'une FK composite vers
-- fournisseurs_categories_handpick : la FK aurait un ON DELETE global. Délier
-- une paire depuis l'onglet Paramètres aurait alors soit détruit/orphelinné
-- des balles historiques (CASCADE / SET NULL), soit rendu le déliement
-- impossible dès qu'une balle l'utilise (RESTRICT) — l'écran Paramètres
-- serait devenu bloquant.
--
-- Le trigger ne se déclenche QUE si la paire change. Une balle créée en
-- janvier avec (F1, C3) reste éditable en juin — on peut changer son statut
-- ou son emplacement — même si (F1, C3) a été déliée entre-temps. C'est le
-- compromis intégrité / réalité opérationnelle.

CREATE OR REPLACE FUNCTION public.balles_handpick_check_fournisseur_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Brouillon : rien à vérifier tant que la paire n'est pas complète.
    IF NEW.fournisseur_id IS NULL OR NEW.category_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.fournisseur_id IS NOT DISTINCT FROM OLD.fournisseur_id
       AND NEW.category_id    IS NOT DISTINCT FROM OLD.category_id
    THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.fournisseurs_categories_handpick fc
        WHERE fc.fournisseur_id = NEW.fournisseur_id
          AND fc.category_id    = NEW.category_id
    ) THEN
        RAISE EXCEPTION
            'Catégorie % non proposée par le fournisseur % (voir Paramètres > Fournisseurs)',
            NEW.category_id, NEW.fournisseur_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS balles_handpick_check_fournisseur_category ON public.balles_handpick;
CREATE TRIGGER balles_handpick_check_fournisseur_category
    BEFORE INSERT OR UPDATE ON public.balles_handpick
    FOR EACH ROW EXECUTE FUNCTION public.balles_handpick_check_fournisseur_category();

-- ─── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.balles_handpick ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balles_handpick_select" ON public.balles_handpick;
CREATE POLICY "balles_handpick_select" ON public.balles_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.inventaire.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "balles_handpick_insert" ON public.balles_handpick;
CREATE POLICY "balles_handpick_insert" ON public.balles_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.inventaire.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "balles_handpick_update" ON public.balles_handpick;
CREATE POLICY "balles_handpick_update" ON public.balles_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.inventaire.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.inventaire.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "balles_handpick_delete" ON public.balles_handpick;
CREATE POLICY "balles_handpick_delete" ON public.balles_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.inventaire.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
