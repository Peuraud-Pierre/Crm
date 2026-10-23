-- ============================================================
-- Permission 'availability.manage' : gérer les horaires & congés Amelia
-- (commerciaux individuels + horaires d'entreprise globaux).
--
-- Décision métier : seul un Admin peut modifier les horaires/congés. Les
-- commerciaux ne peuvent plus modifier les leurs.
--
-- Cette migration :
--   1. CRÉE la permission dans le système (table public.permissions) si absente,
--      afin qu'elle apparaisse dans l'UI de gestion des rôles et reste assignable
--      (ex. à JB) via le système de permissions existant ;
--   2. l'ATTRIBUE aux rôles admin/superadmin (table public.roles_permissions),
--      lue par le helper public.user_has_permission (bridge) et par le RPC
--      get_user_permissions (front).
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- 1. Créer la permission si elle n'existe pas encore.
INSERT INTO public.permissions (code, label, category)
SELECT 'availability.manage', 'Gérer les disponibilités (horaires & congés)', 'crm'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'availability.manage'
);

-- 2. Attribuer la permission aux rôles admin / superadmin.
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE LOWER(COALESCE(r.nom, '')) = ANY (ARRAY['admin', 'superadmin'])
  AND p.code = 'availability.manage'
  AND NOT EXISTS (
      SELECT 1 FROM public.roles_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
