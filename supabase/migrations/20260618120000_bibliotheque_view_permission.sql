-- ============================================================
-- Fix : la page /bibliotheque renvoyait NotFound pour tout le monde.
--
-- Cause (identique à communication.view) : la route (router.tsx) et le menu
-- exigent la permission `bibliotheque.view`, mais ce code n'a jamais été ajouté
-- au catalogue public.permissions. get_user_permissions ne le renvoie donc
-- jamais → hasPermission('bibliotheque.view') = false → AuthGuardLayout affiche
-- NotFound.
--
-- Correctif :
--   1. créer le code dans le catalogue ;
--   2. l'octroyer à tous les rôles/services qui ont déjà `dashboard.view`
--      (= accès interne à l'app).
--
-- Idempotent (gardes NOT EXISTS). Pour restreindre ensuite, gérer les octrois
-- via l'admin des rôles (roles_permissions / services_permissions).
-- ============================================================

-- 1. Catalogue
INSERT INTO public.permissions (code, label, category)
SELECT 'bibliotheque.view', 'Accéder à la page Bibliothèque', 'bibliotheque'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'bibliotheque.view'
);

-- 2. Octroi aux RÔLES disposant déjà de dashboard.view
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions dash   ON dash.id   = rp.permission_id AND dash.code   = 'dashboard.view'
JOIN public.permissions target ON target.code = 'bibliotheque.view'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

-- 3. Octroi aux SERVICES disposant déjà de dashboard.view
INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions dash   ON dash.id   = sp.permission_id AND dash.code   = 'dashboard.view'
JOIN public.permissions target ON target.code = 'bibliotheque.view'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);
