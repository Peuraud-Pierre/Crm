-- ============================================================
-- RLS arrivage_manuel : permissions dédiées par opération
-- Date: 2026-07-07
--
-- Les policies créées par 20260521_arrivage_manuel.sql gardaient
-- toutes les opérations (SELECT/INSERT/UPDATE/DELETE) sur la seule
-- permission 'stock.view'. L'UI, elle, utilise déjà des permKeys
-- dédiés (stock.arrivage.create / stock.arrivage.update /
-- stock.arrivage.export) — la DB n'appliquait pas la même règle :
-- n'importe quel détenteur de stock.view pouvait écrire dans la
-- table via l'API. Cette migration aligne la RLS sur ces permKeys.
--
--   SELECT → stock.arrivage.view    (NOUVELLE — attribuée aux
--            rôles/services ayant stock.view pour ne pas casser
--            l'affichage existant ; restreindre ensuite via l'admin)
--   INSERT → stock.arrivage.create
--   UPDATE → stock.arrivage.update
--   DELETE → stock.arrivage.delete  (NOUVELLE — attribuée à personne :
--            suppression bloquée tant que non accordée ; cf. ticket
--            docs/tickets/arrivage-delete-dedicated-permission.md)
--
-- stock.arrivage.create/update existent déjà en prod (créées via
-- l'admin, utilisées par FlowBoard/ArrivageLimitedTable) mais ne
-- figurent dans aucune migration : on les crée ici de façon
-- idempotente pour qu'un environnement neuf ne verrouille pas la
-- table par absence de code dans public.permissions.
--
-- Toutes les policies conservent l'exigence de session MFA (AAL2).
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Créer les permissions manquantes ────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock'
FROM (VALUES
    ('stock.arrivage.view',   'Voir le tableau des arrivages'),
    ('stock.arrivage.create', 'Créer un arrivage'),
    ('stock.arrivage.update', 'Modifier un arrivage'),
    ('stock.arrivage.delete', 'Supprimer un arrivage')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- ─── 2. Attribuer stock.arrivage.view aux détenteurs de stock.view ──────
-- Préserve l'accès actuel : tout rôle/service qui voit le module Stock
-- continue de voir le tableau. stock.arrivage.delete n'est attribuée à
-- PERSONNE volontairement.

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions src ON src.id = rp.permission_id
    AND src.code = 'stock.view'
JOIN public.permissions target ON target.code = 'stock.arrivage.view'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions src ON src.id = sp.permission_id
    AND src.code = 'stock.view'
JOIN public.permissions target ON target.code = 'stock.arrivage.view'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

-- ─── 3. Re-créer les policies avec les permissions dédiées ──────────────

DROP POLICY IF EXISTS "arrivage_manuel_select" ON public.arrivage_manuel;
CREATE POLICY "arrivage_manuel_select" ON public.arrivage_manuel
    FOR SELECT
    USING (
        has_permission('stock.arrivage.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "arrivage_manuel_insert" ON public.arrivage_manuel;
CREATE POLICY "arrivage_manuel_insert" ON public.arrivage_manuel
    FOR INSERT
    WITH CHECK (
        has_permission('stock.arrivage.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "arrivage_manuel_update" ON public.arrivage_manuel;
CREATE POLICY "arrivage_manuel_update" ON public.arrivage_manuel
    FOR UPDATE
    USING (
        has_permission('stock.arrivage.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.arrivage.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "arrivage_manuel_delete" ON public.arrivage_manuel;
CREATE POLICY "arrivage_manuel_delete" ON public.arrivage_manuel
    FOR DELETE
    USING (
        has_permission('stock.arrivage.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
