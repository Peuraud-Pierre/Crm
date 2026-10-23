-- ============================================================
-- Suppression de l'ancien système d'arrivage (pré-arrivage_manuel)
-- Date: 2026-07-07
--
-- Contexte : la migration arrivage-api/020_clean_packing_schema.sql a
-- recréé factures/items/packages via DROP TABLE ... CASCADE, ce qui a
-- silencieusement supprimé la vue v_arrivages (dépendante de factures)
-- ET les policies RLS de ces trois tables. Le code front qui requêtait
-- v_arrivages/arrivage_state a été retiré — cette migration finit le
-- nettoyage côté DB et ré-applique la RLS perdue.
--
-- Objets supprimés (ancien flow import Excel) :
--   - VIEW v_arrivages (déjà tombée via le CASCADE — drop idempotent)
--   - TABLE arrivage_state (+ trigger set_arrivage_state_updated_at)
--   - TABLE arrivees_departs
--   - RPC set_container_no / set_container_no_from_facture
--   - FUNCTION extract_bic (servait aux jointures de v_arrivages)
-- Conservés : factures / items / packages (packing list, FK
-- arrivage_manuel_id), get_or_create_fournisseur.
-- ============================================================

-- ─── 1. Ancien flow arrivage ────────────────────────────────────────────

DROP VIEW IF EXISTS public.v_arrivages;

DROP FUNCTION IF EXISTS public.set_container_no(integer, text);
DROP FUNCTION IF EXISTS public.set_container_no_from_facture(integer, text);

-- CASCADE : policies RLS + trigger tombent avec les tables
DROP TABLE IF EXISTS public.arrivage_state CASCADE;
DROP FUNCTION IF EXISTS public.set_arrivage_state_updated_at();

DROP TABLE IF EXISTS public.arrivees_departs CASCADE;

-- Indexes expression-based sur extract_bic (migration arrivage-api 019).
-- Ceux d'arrivage_state/arrivees_departs tombent avec les tables ;
-- celui de factures a déjà disparu avec le DROP de la 020 — idempotent.
DROP INDEX IF EXISTS public.factures_container_bic_idx;

DROP FUNCTION IF EXISTS public.extract_bic(text);

-- ─── 2. Ré-application de la RLS sur factures / items / packages ────────
-- Les policies de 20260421121000_arrivages_rls.sql sont tombées avec le
-- DROP CASCADE de la migration arrivage-api 020 : les tables recréées
-- étaient SANS RLS. Même règle qu'avant : stock.view + session AAL2.

-- ─── factures ───────────────────────────────────────────────────────────
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factures_select" ON public.factures;
CREATE POLICY "factures_select" ON public.factures
    FOR SELECT
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "factures_insert" ON public.factures;
CREATE POLICY "factures_insert" ON public.factures
    FOR INSERT
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "factures_update" ON public.factures;
CREATE POLICY "factures_update" ON public.factures
    FOR UPDATE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "factures_delete" ON public.factures;
CREATE POLICY "factures_delete" ON public.factures
    FOR DELETE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- ─── items ──────────────────────────────────────────────────────────────
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select" ON public.items;
CREATE POLICY "items_select" ON public.items
    FOR SELECT
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "items_insert" ON public.items;
CREATE POLICY "items_insert" ON public.items
    FOR INSERT
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "items_update" ON public.items;
CREATE POLICY "items_update" ON public.items
    FOR UPDATE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "items_delete" ON public.items;
CREATE POLICY "items_delete" ON public.items
    FOR DELETE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- ─── packages ───────────────────────────────────────────────────────────
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_select" ON public.packages;
CREATE POLICY "packages_select" ON public.packages
    FOR SELECT
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "packages_insert" ON public.packages;
CREATE POLICY "packages_insert" ON public.packages
    FOR INSERT
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "packages_update" ON public.packages;
CREATE POLICY "packages_update" ON public.packages
    FOR UPDATE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "packages_delete" ON public.packages;
CREATE POLICY "packages_delete" ON public.packages
    FOR DELETE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
