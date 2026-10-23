-- ============================================================
-- Stock Handpick — flux : mouvements d'entrée et de sortie
-- Date: 2026-09-07
-- Dépend de : 20260914141000 (référentiel), 20260914142000 (plan),
--             20260914143000 (balles)
--
-- Contexte
-- --------
-- L'onglet Flux présente deux tableaux — arrivages et départs — qui
-- sont deux lectures de la MÊME table, filtrées sur `direction`. Une
-- ligne = un mouvement. Un arrivage de 40 balles = 40 lignes
-- partageant un `batch_id`.
--
-- Pourquoi pas de table d'en-tête `arrivages_handpick` : en V1 un
-- arrivage n'a aucun attribut propre au-delà de ce que portent déjà
-- ses lignes (date, fournisseur, référence externe). Un batch_id nu
-- suffit au regroupement — la couche service génère un
-- crypto.randomUUID() et l'applique aux N lignes.
--
-- Le jour où un arrivage gagne des attributs (n° conteneur,
-- transporteur, statut de déchargement), on crée la table d'en-tête
-- et batch_id devient sa FK. C'est précisément pour ça qu'il est typé
-- UUID SANS contrainte dès maintenant : la migration future se
-- résume à un ALTER TABLE ADD CONSTRAINT après backfill.
--
-- Mouvements ÉDITABLES en V1 (pas d'append-only) : la correction
-- d'une saisie ne doit pas exiger un mouvement inverse. En revanche
-- stock_handpick.flux.delete n'est accordée à personne par défaut —
-- durcir se fera en retirant la permission, pas en migrant la table.
--
-- Mapping permKey → policy :
--   SELECT → stock_handpick.flux.view
--   INSERT → stock_handpick.flux.create
--   UPDATE → stock_handpick.flux.update
--   DELETE → stock_handpick.flux.delete
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mouvements_handpick (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Regroupe les lignes d'un même arrivage / départ. Volontairement
    -- SANS FK (voir en-tête).
    batch_id            UUID,

    direction           TEXT        NOT NULL,
    motif               TEXT        NOT NULL,

    -- ── Objet du mouvement ───────────────────────────────────────────
    balle_id            UUID        REFERENCES public.balles_handpick(id) ON DELETE SET NULL,
    -- Snapshot du libellé de la balle au moment du mouvement : le flux
    -- reste lisible même si la balle est supprimée par la suite.
    balle_label         TEXT,
    category_id         UUID        REFERENCES public.categories_handpick(id)   ON DELETE SET NULL,
    fournisseur_id      UUID        REFERENCES public.fournisseurs_handpick(id) ON DELETE SET NULL,

    quantity            NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantity_unit       TEXT        NOT NULL DEFAULT 'kg',

    -- ── Déplacement dans le plan ─────────────────────────────────────
    emplacement_from_id UUID        REFERENCES public.emplacements_handpick(id) ON DELETE SET NULL,
    emplacement_to_id   UUID        REFERENCES public.emplacements_handpick(id) ON DELETE SET NULL,

    -- ── Valorisation ─────────────────────────────────────────────────
    unit_price          NUMERIC(12,4),
    -- Colonne générée : pas de dérive possible entre la valeur affichée
    -- et ses composantes. Ne rien y mettre de susceptible d'évoluer
    -- (remises, taxes) — PG 15 n'a pas d'ALTER ... SET EXPRESSION, une
    -- formule qui change impose un DROP/ADD COLUMN.
    total_value         NUMERIC(16,4)
        GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED,

    -- Date MÉTIER du mouvement, distincte de created_at (date de saisie) :
    -- on enregistre souvent un arrivage le lendemain de sa réception.
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- N° de BL, de facture, de conteneur…
    reference_externe   TEXT,
    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT mouvements_handpick_direction_valid
        CHECK (direction IN ('in', 'out')),

    -- Le motif dépend du sens : un CHECK croisé plutôt que deux colonnes
    -- libres. Le miroir TypeScript est MOTIFS_BY_DIRECTION, pour que l'UI
    -- ne propose jamais un motif que la base refusera.
    CONSTRAINT mouvements_handpick_motif_matches_direction CHECK (
        (direction = 'in'  AND motif IN (
            'arrivage', 'retour', 'transfert_entrant', 'production', 'ajustement'))
        OR
        (direction = 'out' AND motif IN (
            'vente', 'depart', 'transfert_sortant', 'casse', 'perte', 'ajustement'))
    ),

    CONSTRAINT mouvements_handpick_quantity_unit_valid
        CHECK (quantity_unit IN ('kg', 'pieces')),
    CONSTRAINT mouvements_handpick_quantity_positive
        CHECK (quantity >= 0),
    CONSTRAINT mouvements_handpick_unit_price_positive
        CHECK (unit_price IS NULL OR unit_price >= 0),

    -- Un mouvement est soit tracé à la balle (cas normal), soit exprimé
    -- en vrac par catégorie (pesée globale, ajustement d'inventaire).
    CONSTRAINT mouvements_handpick_has_subject CHECK (
        balle_id IS NOT NULL
        OR (category_id IS NOT NULL AND quantity > 0)
    ),

    CONSTRAINT mouvements_handpick_emplacements_differ CHECK (
        emplacement_from_id IS NULL
        OR emplacement_to_id IS NULL
        OR emplacement_from_id <> emplacement_to_id
    )
);

COMMENT ON COLUMN public.mouvements_handpick.batch_id IS
    'Regroupe les lignes d''un même arrivage / départ. Sans FK à dessein : '
    'deviendra la FK d''une future table d''en-tête si un arrivage gagne des '
    'attributs propres.';

COMMENT ON COLUMN public.mouvements_handpick.occurred_at IS
    'Date métier du mouvement (réception, expédition). Distincte de created_at, '
    'qui est la date de saisie.';

-- ─── Index ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_occurred
    ON public.mouvements_handpick (occurred_at DESC);

-- Les deux tableaux de l'onglet Flux (arrivages / départs).
CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_direction
    ON public.mouvements_handpick (direction, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_balle
    ON public.mouvements_handpick (balle_id);

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_batch
    ON public.mouvements_handpick (batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_category
    ON public.mouvements_handpick (category_id);

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_fournisseur
    ON public.mouvements_handpick (fournisseur_id);

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_to
    ON public.mouvements_handpick (emplacement_to_id);

DROP TRIGGER IF EXISTS set_mouvements_handpick_updated_at ON public.mouvements_handpick;
CREATE TRIGGER set_mouvements_handpick_updated_at
    BEFORE UPDATE ON public.mouvements_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.mouvements_handpick ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mouvements_handpick_select" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_select" ON public.mouvements_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.flux.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "mouvements_handpick_insert" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_insert" ON public.mouvements_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.flux.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "mouvements_handpick_update" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_update" ON public.mouvements_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.flux.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.flux.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "mouvements_handpick_delete" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_delete" ON public.mouvements_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.flux.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
