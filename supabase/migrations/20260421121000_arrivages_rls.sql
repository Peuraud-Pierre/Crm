-- ============================================================
-- RLS sur les tables du domaine arrivage
-- Date: 2026-04-21
--
-- Protège les tables alimentées par arrivage-api (factures/items/
-- packages/arrivees_departs) + l'état opérationnel (arrivage_state).
-- Règle : permission 'stock.view' + session MFA (AAL2), sur toutes
-- les opérations (SELECT/INSERT/UPDATE/DELETE).
-- ============================================================

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

-- ─── arrivees_departs ───────────────────────────────────────────────────
ALTER TABLE public.arrivees_departs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arrivees_departs_select" ON public.arrivees_departs;
CREATE POLICY "arrivees_departs_select" ON public.arrivees_departs
    FOR SELECT
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "arrivees_departs_insert" ON public.arrivees_departs;
CREATE POLICY "arrivees_departs_insert" ON public.arrivees_departs
    FOR INSERT
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "arrivees_departs_update" ON public.arrivees_departs;
CREATE POLICY "arrivees_departs_update" ON public.arrivees_departs
    FOR UPDATE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "arrivees_departs_delete" ON public.arrivees_departs;
CREATE POLICY "arrivees_departs_delete" ON public.arrivees_departs
    FOR DELETE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- ─── arrivage_state ─────────────────────────────────────────────────────
-- Remplace les policies permissives créées dans la migration
-- 20260421120000_arrivages_unified_view.sql.
ALTER TABLE public.arrivage_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arrivage_state_select" ON public.arrivage_state;
DROP POLICY IF EXISTS "arrivage_state_write"  ON public.arrivage_state;

CREATE POLICY "arrivage_state_select" ON public.arrivage_state
    FOR SELECT
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "arrivage_state_insert" ON public.arrivage_state
    FOR INSERT
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "arrivage_state_update" ON public.arrivage_state
    FOR UPDATE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "arrivage_state_delete" ON public.arrivage_state
    FOR DELETE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
