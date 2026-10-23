-- ============================================================
-- Suppression de la permission 'stats.view'
--
-- Code introduit le 2026-07-01 (5a3e878a) comme marqueur de
-- « stats restreintes », testé de façon inversée
-- (`!hasPermission("stats.view")`). L'onglet « Statistiques Leads »
-- est désormais gaté positivement par 'leads_stats.view', le code
-- réel de la catégorie `leads_stats`. Plus aucune lecture de
-- 'stats.view' dans le code applicatif.
--
-- Les jonctions roles_permissions / services_permissions /
-- users_permissions référencent permissions(id) ON DELETE CASCADE :
-- les attributions partent avec la ligne.
-- ============================================================

-- Contrôle avant application (à exécuter à part) :
--   SELECT p.id, p.code, count(rp.*) AS roles, count(sp.*) AS services,
--          count(up.*) AS users
--   FROM public.permissions p
--   LEFT JOIN public.roles_permissions    rp ON rp.permission_id = p.id
--   LEFT JOIN public.services_permissions sp ON sp.permission_id = p.id
--   LEFT JOIN public.users_permissions    up ON up.permission_id = p.id
--   WHERE p.code = 'stats.view'
--   GROUP BY p.id, p.code;

DELETE FROM public.permissions WHERE code = 'stats.view';
