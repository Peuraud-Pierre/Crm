-- ============================================================
-- Migration des permissions depuis roles.permissions (JSON)
-- vers la table roles_permissions (normalisée)
-- Seules les permissions à true sont insérées
-- ============================================================

-- Chef de Service
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Chef de Service'
  AND p.code IN (
    'users.view',
    'manager.view',
    'manager.annonce',
    'manager.changelog',
    'manager.maintenance',
    'sorters.view',
    'sorters.delete',
    'projects.create',
    'messaging.create_group',
    'messaging.see_all_direct',
    'roles_services.view'
  )
ON CONFLICT DO NOTHING;

-- Employé
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Employé'
  AND p.code IN (
    'sorters.edit',
    'sorters.create',
    'messaging.create_group'
  )
ON CONFLICT DO NOTHING;

-- Manager
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Manager'
  AND p.code IN (
    'users.view',
    'manager.view',
    'manager.annonce',
    'manager.changelog',
    'manager.maintenance',
    'projects.create',
    'messaging.create_group',
    'messaging.see_all_direct',
    'roles_services.view',
    'manager_sorters.edit',
    'manager_sorters.create',
    'manager_sorters.delete'
  )
ON CONFLICT DO NOTHING;

-- Supervision
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Supervision'
  AND p.code IN (
    'users.view',
    'manager.view',
    'manager.annonce',
    'manager.changelog',
    'manager.maintenance',
    'projects.create',
    'messaging.create_group',
    'messaging.see_all_direct',
    'roles_services.view'
  )
ON CONFLICT DO NOTHING;
