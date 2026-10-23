-- ============================================================
-- Stock Handpick — alignement avant mise en production
-- Date: 2026-09-14
-- Dépend de : 20260914140000 → 20260914152000 (toutes les migrations
--             du module). À appliquer EN DERNIER.
--
-- Contexte
-- --------
-- Les migrations du module ont été écrites avant d'être relues sous
-- l'angle de la production. Quatre écarts, corrigés ici plutôt qu'en
-- réécrivant des fichiers déjà appliqués en base de dev :
--
--   1. `flux_handpick` n'est pas dans la publication realtime. La table
--      a été créée par 20260914150000, après la migration 20260914145000
--      qui publiait `balles_handpick` et `mouvements_handpick`. Le client
--      s'abonne pourtant à ses changements (fluxHandpickService
--      .subscribeToFlux) : une modification d'en-tête faite par un
--      collègue n'apparaissait qu'au rechargement.
--
--   2. `apply_flux_handpick_status_transitions()` est SECURITY DEFINER
--      et, comme toute fonction créée sans REVOKE, exécutable par
--      PUBLIC — donc appelable en RPC par `anon` et `authenticated`.
--      Elle ne sert qu'à pg_cron (exécuté par le propriétaire) : on
--      retire le droit d'exécution à tous les rôles d'API.
--
--   3. Les policies évaluaient `has_permission(...)` PAR LIGNE et
--      s'appliquaient à tous les rôles. Même correctif que
--      20260706120000_logs_crm_rls_perf.sql : `(SELECT has_permission())`
--      devient un InitPlan évalué une fois par requête, et `TO
--      authenticated` écarte `anon` avant toute évaluation.
--
--   4. Éditer les catégories d'un fournisseur (Paramètres) écrit dans
--      `fournisseurs_categories_handpick` par INSERT et DELETE, que les
--      policies gataient sur `settings.create` / `settings.delete`. Un
--      compte autorisé à MODIFIER un fournisseur échouait donc à changer
--      ses catégories. Décision : c'est une modification du fournisseur,
--      les trois écritures de la liaison sont gatées sur
--      `stock_handpick.settings.update`.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

-- ─── 1. Realtime : en-têtes de flux ─────────────────────────────────────
-- Même garde que 20260914145000 : ADD TABLE échoue si la table est déjà
-- membre de la publication.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname    = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'flux_handpick'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.flux_handpick;
        RAISE NOTICE 'Realtime activé pour public.flux_handpick';
    END IF;
END;
$$;

-- ─── 2. Fonction de transition : réservée à pg_cron ─────────────────────

REVOKE EXECUTE ON FUNCTION public.apply_flux_handpick_status_transitions()
    FROM PUBLIC, anon, authenticated;

-- ─── 3. Policies ────────────────────────────────────────────────────────
-- Mapping permKey inchangé, sauf la liaison fournisseur ↔ catégorie (§4
-- de l'en-tête). DROP + CREATE plutôt qu'ALTER POLICY : `TO` ne se modifie
-- pas proprement sur une policy créée pour PUBLIC dans toutes les
-- versions, et la recréation garde le fichier ré-exécutable.

-- fournisseurs_handpick

DROP POLICY IF EXISTS "fournisseurs_handpick_select" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_select" ON public.fournisseurs_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "fournisseurs_handpick_insert" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_insert" ON public.fournisseurs_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.settings.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "fournisseurs_handpick_update" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_update" ON public.fournisseurs_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "fournisseurs_handpick_delete" ON public.fournisseurs_handpick;
CREATE POLICY "fournisseurs_handpick_delete" ON public.fournisseurs_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.settings.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- categories_handpick

DROP POLICY IF EXISTS "categories_handpick_select" ON public.categories_handpick;
CREATE POLICY "categories_handpick_select" ON public.categories_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "categories_handpick_insert" ON public.categories_handpick;
CREATE POLICY "categories_handpick_insert" ON public.categories_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.settings.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "categories_handpick_update" ON public.categories_handpick;
CREATE POLICY "categories_handpick_update" ON public.categories_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "categories_handpick_delete" ON public.categories_handpick;
CREATE POLICY "categories_handpick_delete" ON public.categories_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.settings.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- fournisseurs_categories_handpick — les écritures suivent settings.update

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_select" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_select" ON public.fournisseurs_categories_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_insert" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_insert" ON public.fournisseurs_categories_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_update" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_update" ON public.fournisseurs_categories_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "fournisseurs_categories_handpick_delete" ON public.fournisseurs_categories_handpick;
CREATE POLICY "fournisseurs_categories_handpick_delete" ON public.fournisseurs_categories_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.settings.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- zones_handpick

DROP POLICY IF EXISTS "zones_handpick_select" ON public.zones_handpick;
CREATE POLICY "zones_handpick_select" ON public.zones_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "zones_handpick_insert" ON public.zones_handpick;
CREATE POLICY "zones_handpick_insert" ON public.zones_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.plan.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "zones_handpick_update" ON public.zones_handpick;
CREATE POLICY "zones_handpick_update" ON public.zones_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "zones_handpick_delete" ON public.zones_handpick;
CREATE POLICY "zones_handpick_delete" ON public.zones_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.plan.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- emplacements_handpick

DROP POLICY IF EXISTS "emplacements_handpick_select" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_select" ON public.emplacements_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "emplacements_handpick_insert" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_insert" ON public.emplacements_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.plan.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "emplacements_handpick_update" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_update" ON public.emplacements_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.plan.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "emplacements_handpick_delete" ON public.emplacements_handpick;
CREATE POLICY "emplacements_handpick_delete" ON public.emplacements_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.plan.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- balles_handpick

DROP POLICY IF EXISTS "balles_handpick_select" ON public.balles_handpick;
CREATE POLICY "balles_handpick_select" ON public.balles_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.inventaire.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "balles_handpick_insert" ON public.balles_handpick;
CREATE POLICY "balles_handpick_insert" ON public.balles_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.inventaire.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "balles_handpick_update" ON public.balles_handpick;
CREATE POLICY "balles_handpick_update" ON public.balles_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.inventaire.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.inventaire.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "balles_handpick_delete" ON public.balles_handpick;
CREATE POLICY "balles_handpick_delete" ON public.balles_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.inventaire.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- flux_handpick

DROP POLICY IF EXISTS "flux_handpick_select" ON public.flux_handpick;
CREATE POLICY "flux_handpick_select" ON public.flux_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.flux.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "flux_handpick_insert" ON public.flux_handpick;
CREATE POLICY "flux_handpick_insert" ON public.flux_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.flux.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "flux_handpick_update" ON public.flux_handpick;
CREATE POLICY "flux_handpick_update" ON public.flux_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.flux.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.flux.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "flux_handpick_delete" ON public.flux_handpick;
CREATE POLICY "flux_handpick_delete" ON public.flux_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.flux.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- mouvements_handpick

DROP POLICY IF EXISTS "mouvements_handpick_select" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_select" ON public.mouvements_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.flux.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "mouvements_handpick_insert" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_insert" ON public.mouvements_handpick
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock_handpick.flux.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "mouvements_handpick_update" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_update" ON public.mouvements_handpick
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.flux.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock_handpick.flux.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "mouvements_handpick_delete" ON public.mouvements_handpick;
CREATE POLICY "mouvements_handpick_delete" ON public.mouvements_handpick
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.flux.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- activity_log_handpick — lecture seule, aucune policy d'écriture
-- (les triggers SECURITY DEFINER écrivent ; cf. 20260914145000 §5).

DROP POLICY IF EXISTS "activity_log_handpick_select" ON public.activity_log_handpick;
CREATE POLICY "activity_log_handpick_select" ON public.activity_log_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.history.view'::text))
        AND (SELECT auth_session_is_aal2())
    );
