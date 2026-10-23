-- Permission dédiée : gérer la disponibilité Amelia des AUTRES commerciaux.
--
-- Utilisée par :
--   - le front (onglet « Gérer les disponibilités ») via hasPermission ;
--   - le bridge Go (PUT/GET /crm/availability avec un userId ≠ soi) via le
--     helper public.user_has_permission(uid, 'availability.manage').
--
-- Cette migration ne fait que CRÉER le code. Il faut ensuite l'assigner aux
-- rôles/services managers concernés (table roles_permissions / services_permissions),
-- via l'admin des rôles ou un INSERT dédié selon vos role_id.

INSERT INTO public.permissions (code, label, category)
SELECT 'availability.manage', 'Gérer les disponibilités des commerciaux', 'crm'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'availability.manage'
);
