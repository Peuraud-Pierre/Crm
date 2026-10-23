-- Permission de supervision du classement des packing lists.
--
-- Dépend de : 20260915100000_stock_packing_list.sql (permissions stock.packing.*)
--             20260918100000_stock_packing_learning.sql (packing_label_feedback)
--
-- Ouvre la console /packing-admin, qui montre la santé de `packing-api`, la
-- courbe d'apprentissage du modèle, l'historique des imports, les libellés où
-- l'humain a contredit le modèle, et un simulateur de seuil.
--
-- AUCUNE RLS n'est touchée : la console ne lit que des tables déjà gardées par
-- `stock.packing.view` (packing_list, packing_list_ligne, packing_label_feedback,
-- packing_label_category). C'est volontaire — une console de supervision ne doit
-- pas ouvrir un accès que l'écran de travail n'a pas.

-- ─── 1. La permission ───────────────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock'
FROM (VALUES
    ('stock.packing.admin', 'Superviser le classement des packing lists')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- ─── 2. Attribution ─────────────────────────────────────────────────────
-- Source : `stock.arrivage.newsletter.admin`. Qui supervise déjà un service
-- externe (la console newsletter) est le bon public pour celui-ci — et non
-- l'ensemble des personnes qui importent une packing list.
--
-- `stock.packing.view` est accordée EN MÊME TEMPS. Le gating de route porte sur
-- `admin`, mais toutes les lectures passent par la RLS `view` : sans cette
-- seconde ligne, un administrateur sans `view` ouvrirait une console vide, sans
-- erreur et sans explication. Le `NOT EXISTS` la rend inoffensive pour ceux qui
-- l'ont déjà.

WITH mapping(src, target) AS (
    VALUES
        ('stock.arrivage.newsletter.admin', 'stock.packing.admin'),
        ('stock.arrivage.newsletter.admin', 'stock.packing.view')
)
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, tp.id
FROM mapping m
JOIN public.permissions sp ON sp.code = m.src
JOIN public.roles_permissions rp ON rp.permission_id = sp.id
JOIN public.permissions tp ON tp.code = m.target
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = tp.id
);

WITH mapping(src, target) AS (
    VALUES
        ('stock.arrivage.newsletter.admin', 'stock.packing.admin'),
        ('stock.arrivage.newsletter.admin', 'stock.packing.view')
)
INSERT INTO public.services_permissions (service_id, permission_id)
SELECT DISTINCT spm.service_id, tp.id
FROM mapping m
JOIN public.permissions sp ON sp.code = m.src
JOIN public.services_permissions spm ON spm.permission_id = sp.id
JOIN public.permissions tp ON tp.code = m.target
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = spm.service_id AND x.permission_id = tp.id
);
