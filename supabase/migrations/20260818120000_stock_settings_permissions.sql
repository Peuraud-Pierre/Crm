-- ============================================================
-- Référentiel stock (catégories / fournisseurs) : permissions
-- dédiées + RLS alignée.
-- Date: 2026-08-18
--
-- Contexte
-- --------
-- L'UI de l'onglet « Paramètres » du module Stock lit déjà
-- stock.settings.create / .update / .delete (CategoriesMenu,
-- FournisseursMenu) mais ces codes n'existent dans AUCUNE
-- migration : ils ne sont donc dans aucune ligne de
-- public.permissions, personne ne peut les détenir, et l'admin
-- ne peut pas les accorder depuis /administration (le catalogue
-- est lu depuis cette table). Cette migration les crée, ajoute
-- les deux permissions de visibilité d'onglet, et verrouille
-- enfin la base.
--
-- categories_gestion et fournisseur_gestion ont été créées via
-- le dashboard Supabase, avant le dossier migrations/ : elles
-- n'ont aucune policy versionnée. La garde par permission était
-- purement UI — n'importe quel détenteur de stock.view pouvait
-- écrire via l'API. Même anti-pattern que celui corrigé pour
-- arrivage_manuel par 20260707130000_arrivage_manuel_permissions.
--
--   SELECT → stock.view              (lecture du référentiel :
--            les selects catégorie/fournisseur sont utilisés
--            partout dans le module, ne pas restreindre plus)
--   INSERT → stock.settings.create
--   UPDATE → stock.settings.update
--   DELETE → stock.settings.delete
--
-- Toutes les policies conservent l'exigence de session MFA
-- (AAL2), comme le reste des policies stock.
--
-- ⚠️ AVANT D'APPLIQUER : relever l'existant, cette migration
--    supprime TOUTES les policies préexistantes sur ces deux
--    tables (§3) pour rendre l'état déterministe. Les policies
--    étant combinées en OR, en laisser une permissive
--    annulerait tout le verrouillage.
--
--      select * from pg_policies
--      where tablename in ('categories_gestion','fournisseur_gestion');
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Créer les permissions manquantes ────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock'
FROM (VALUES
    ('stock.settings.view',   'Voir les paramètres du stock'),
    ('stock.settings.create', 'Créer une catégorie / un fournisseur'),
    ('stock.settings.update', 'Modifier une catégorie / un fournisseur'),
    ('stock.settings.delete', 'Supprimer une catégorie / un fournisseur'),
    ('stock.history.view',    'Voir l''historique du stock')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- ─── 2. Backfill des permissions de VISIBILITÉ uniquement ───────────────
-- stock.settings.view et stock.history.view sont attribuées aux
-- rôles/services détenant déjà stock.arrivage.view : ceux qui
-- travaillent sur les arrivages voient les deux nouveaux onglets.
--
-- Les trois permissions d'ÉCRITURE ne sont volontairement
-- attribuées à personne : elles se donnent au cas par cas depuis
-- /administration. C'est précisément le geste que la feature vise
-- à rendre suffisant — une fois accordée, l'utilisateur gère son
-- référentiel sans intervention en base.

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions src ON src.id = rp.permission_id
    AND src.code = 'stock.arrivage.view'
JOIN public.permissions target
    ON target.code IN ('stock.settings.view', 'stock.history.view')
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions src ON src.id = sp.permission_id
    AND src.code = 'stock.arrivage.view'
JOIN public.permissions target
    ON target.code IN ('stock.settings.view', 'stock.history.view')
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

-- Les attributions individuelles comptent autant que celles par rôle/service
-- (`user_has_permission` est un OU des trois sources) : sans ce troisième
-- backfill, un utilisateur dont `stock.arrivage.view` a été accordée à la main
-- depuis /administration ne verrait aucun des deux nouveaux onglets.

INSERT INTO public.users_permissions (user_id, permission_id)
SELECT up.user_id, target.id
FROM public.users_permissions up
JOIN public.permissions src ON src.id = up.permission_id
    AND src.code = 'stock.arrivage.view'
JOIN public.permissions target
    ON target.code IN ('stock.settings.view', 'stock.history.view')
WHERE NOT EXISTS (
    SELECT 1 FROM public.users_permissions x
    WHERE x.user_id = up.user_id AND x.permission_id = target.id
);

-- ─── 3. Purge des policies préexistantes (état déterministe) ────────────
-- Leurs noms sont inconnus du dépôt (tables antérieures aux
-- migrations) : on les énumère depuis pg_policies plutôt que de
-- deviner. Voir l'avertissement en tête de fichier.

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('categories_gestion', 'fournisseur_gestion')
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.%I',
            pol.policyname, pol.tablename
        );
    END LOOP;
END
$$;

-- ─── 4. Policies alignées sur les permKeys ──────────────────────────────

ALTER TABLE public.categories_gestion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseur_gestion ENABLE ROW LEVEL SECURITY;

-- categories_gestion

CREATE POLICY "categories_gestion_select" ON public.categories_gestion
    FOR SELECT
    USING (
        (
            has_permission('stock.view'::text)
            -- Le CRM lit `categories_gestion` pour son sélecteur produit
            -- (src/features/crm/services/fournisseurService.ts) : sans cette
            -- branche, la création de devis perdrait silencieusement sa liste
            -- pour tout utilisateur CRM n'ayant pas accès au module Stock.
            OR has_permission('crm.view'::text)
        )
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "categories_gestion_insert" ON public.categories_gestion
    FOR INSERT
    WITH CHECK (
        has_permission('stock.settings.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "categories_gestion_update" ON public.categories_gestion
    FOR UPDATE
    USING (
        has_permission('stock.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "categories_gestion_delete" ON public.categories_gestion
    FOR DELETE
    USING (
        has_permission('stock.settings.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- fournisseur_gestion

CREATE POLICY "fournisseur_gestion_select" ON public.fournisseur_gestion
    FOR SELECT
    USING (
        (
            has_permission('stock.view'::text)
            -- Le CRM lit `categories_gestion` pour son sélecteur produit
            -- (src/features/crm/services/fournisseurService.ts) : sans cette
            -- branche, la création de devis perdrait silencieusement sa liste
            -- pour tout utilisateur CRM n'ayant pas accès au module Stock.
            OR has_permission('crm.view'::text)
        )
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "fournisseur_gestion_insert" ON public.fournisseur_gestion
    FOR INSERT
    WITH CHECK (
        has_permission('stock.settings.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "fournisseur_gestion_update" ON public.fournisseur_gestion
    FOR UPDATE
    USING (
        has_permission('stock.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.settings.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "fournisseur_gestion_delete" ON public.fournisseur_gestion
    FOR DELETE
    USING (
        has_permission('stock.settings.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
