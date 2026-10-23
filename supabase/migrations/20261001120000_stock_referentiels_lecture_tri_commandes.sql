-- ============================================================
-- Lecture des référentiels du stock par la salle de tri et la salle de
-- commande
-- Date: 2026-10-01
--
-- Contexte
-- --------
-- La salle de tri (/salle-de-tri) et la salle de commande (/commandes) sont
-- des PAGES À PART, hors de /stock : leurs utilisateurs n'ont pas forcément
-- `stock.view`. Or elles lisent les référentiels du stock principal :
--   * salle de tri    : fournisseurs ET catégories (balles de chaque fiche :
--                       `v_fiches_tri_balles` lit le nom du fournisseur) ;
--   * salle de commande : catégories (lien facultatif d'un article).
--
-- Les deux politiques SELECT de 20260818120000_stock_settings_permissions.sql
-- sont recréées à l'identique, avec une branche de plus. Les écritures ne
-- changent pas (`stock.settings.*`).
--
-- À appliquer APRÈS 20261001100000 et 20261001110000 (permissions créées).
-- Idempotent.
-- ============================================================

DROP POLICY IF EXISTS "categories_gestion_select" ON public.categories_gestion;
CREATE POLICY "categories_gestion_select" ON public.categories_gestion
    FOR SELECT
    USING (
        (
            has_permission('stock.view'::text)
            -- Le CRM lit `categories_gestion` pour son sélecteur produit.
            OR has_permission('crm.view'::text)
            -- Pages à part liées au stock (2026-10-01).
            OR has_permission('stock.tri.view'::text)
            OR has_permission('stock.commandes.view'::text)
        )
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "fournisseur_gestion_select" ON public.fournisseur_gestion;
CREATE POLICY "fournisseur_gestion_select" ON public.fournisseur_gestion
    FOR SELECT
    USING (
        (
            has_permission('stock.view'::text)
            OR has_permission('crm.view'::text)
            -- La salle de tri rattache chaque fiche à un fournisseur.
            OR has_permission('stock.tri.view'::text)
        )
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
