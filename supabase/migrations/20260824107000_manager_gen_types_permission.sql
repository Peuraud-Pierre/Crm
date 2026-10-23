-- ============================================================
-- Permission `manager.gen_types`
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- L'onglet « Gen Types » de la console Manager était gaté par
-- `user?.role === "Super Admin"` — une comparaison sur le LIBELLÉ du
-- rôle. Avec le contournement de maintenance (résorbé par
-- 20260824100000), c'était le dernier gate de ce type dans
-- l'application : renommer le rôle « Super Admin » depuis
-- /administration ouvrait ou fermait silencieusement l'accès à un outil
-- de génération de types.
--
-- Ce code lui donne un équivalent attribuable. Le backfill sur le rôle
-- « Super Admin » **préserve exactement le comportement actuel** : les
-- mêmes personnes gardent l'onglet après la bascule du front. Il est
-- ensuite accordable à d'autres depuis /administration, sans toucher au
-- code.
--
-- Sans effet si aucun rôle ne porte ce nom — auquel cas personne ne
-- détient le code, et l'onglet reste masqué (comportement sûr pour un
-- outil de ce genre).
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

INSERT INTO public.permissions (code, label, category)
SELECT 'manager.gen_types',
       'Générer les types TypeScript depuis le schéma',
       'manager'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'manager.gen_types'
);

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Super Admin'
  AND p.code = 'manager.gen_types'
  AND NOT EXISTS (
      SELECT 1 FROM public.roles_permissions x
      WHERE x.role_id = r.id AND x.permission_id = p.id
  );
