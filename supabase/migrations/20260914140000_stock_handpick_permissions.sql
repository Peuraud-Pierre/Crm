-- ============================================================
-- Stock Handpick — registre des permissions
-- Date: 2026-09-07
--
-- Contexte
-- --------
-- `stock_handpick` est un SECOND stock, isolé du stock principal
-- (`src/features/stock`) : ses propres tables (suffixe `_handpick`),
-- son propre référentiel, ses propres permissions. « Handpick »
-- n'était jusqu'ici qu'une valeur de `BalleLocation` dans
-- balles_gestion — insuffisant pour en faire un module autonome.
--
-- Cette migration ne crée AUCUNE table : elle pose uniquement les
-- codes dans public.permissions, pour que les migrations suivantes
-- puissent y adosser leur RLS et que /administration les propose
-- au catalogue (celui-ci est lu depuis cette table).
--
-- ⚠️ AUCUN BACKFILL — décision explicite.
-- Contrairement à 20260818120000_stock_settings_permissions.sql qui
-- recopiait les détenteurs de stock.arrivage.view, aucune ligne n'est
-- insérée dans roles_permissions / services_permissions /
-- users_permissions. Le stock handpick peut concerner une équipe
-- différente du stock principal : hériter de ses accès serait un
-- octroi non voulu.
--
-- CONSÉQUENCE OPÉRATIONNELLE : au déploiement, PERSONNE ne voit le
-- module — y compris l'administrateur. Premier geste après
-- application : s'accorder `stock_handpick.view` (puis les onglets
-- souhaités) depuis /administration.
--
-- Rappel : user_has_permission est un OU des trois sources
-- (rôle / service / utilisateur). Une attribution individuelle
-- depuis /administration suffit donc.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock_handpick'
FROM (VALUES
    -- Accès au module (gate du routeur, cf. docs/ROUTING.md)
    ('stock_handpick.view',              'Accéder au stock handpick'),

    -- Onglet Dashboard
    ('stock_handpick.dashboard.view',    'Voir le dashboard du stock handpick'),

    -- Onglet Inventaire (balles)
    ('stock_handpick.inventaire.view',   'Voir l''inventaire handpick'),
    ('stock_handpick.inventaire.create', 'Créer une balle handpick'),
    ('stock_handpick.inventaire.update', 'Modifier une balle handpick'),
    ('stock_handpick.inventaire.delete', 'Supprimer une balle handpick'),

    -- Onglet Flux (arrivages / départs)
    ('stock_handpick.flux.view',         'Voir les flux du stock handpick'),
    ('stock_handpick.flux.create',       'Enregistrer un mouvement handpick'),
    ('stock_handpick.flux.update',       'Modifier un mouvement handpick'),
    ('stock_handpick.flux.delete',       'Supprimer un mouvement handpick'),

    -- Onglet Historique
    ('stock_handpick.history.view',      'Voir l''historique du stock handpick'),

    -- Onglet Paramètres (référentiel fournisseurs / catégories)
    ('stock_handpick.settings.view',     'Voir les paramètres du stock handpick'),
    ('stock_handpick.settings.create',   'Créer un fournisseur / une catégorie handpick'),
    ('stock_handpick.settings.update',   'Modifier un fournisseur / une catégorie handpick'),
    ('stock_handpick.settings.delete',   'Supprimer un fournisseur / une catégorie handpick'),

    -- Plan de l'entrepôt (zones / emplacements) — modèle de données
    -- posé dès maintenant, l'éditeur 2D viendra plus tard.
    ('stock_handpick.plan.view',         'Voir le plan de l''entrepôt handpick'),
    ('stock_handpick.plan.create',       'Créer une zone / un emplacement handpick'),
    ('stock_handpick.plan.update',       'Modifier une zone / un emplacement handpick'),
    ('stock_handpick.plan.delete',       'Supprimer une zone / un emplacement handpick')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);
