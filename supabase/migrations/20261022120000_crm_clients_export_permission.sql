-- ============================================================
-- Permission `crm.clients.export`
-- Date: 2026-10-22
--
-- Contexte
-- --------
-- Le bouton « Export » de l'onglet Clients du CRM télécharge toute la
-- table client_crm visible par l'utilisateur (coordonnées, adresses,
-- SIRET/TVA, brief) au format Excel. Réservé aux admins.
--
-- Pas de gate sur le libellé du rôle côté front (cf.
-- 20260824107000_manager_gen_types_permission.sql) : un code de
-- permission, attribué au rôle « Super Admin », puis accordable à
-- d'autres depuis /administration sans toucher au code.
--
-- Sans effet si aucun rôle ne porte ce nom — personne ne détient alors
-- le code et le bouton reste masqué (comportement sûr pour un export de
-- données personnelles).
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

INSERT INTO public.permissions (code, label, category)
SELECT 'crm.clients.export',
       'Exporter toute la base clients (Excel)',
       'crm'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'crm.clients.export'
);

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Super Admin'
  AND p.code = 'crm.clients.export'
  AND NOT EXISTS (
      SELECT 1 FROM public.roles_permissions x
      WHERE x.role_id = r.id AND x.permission_id = p.id
  );
