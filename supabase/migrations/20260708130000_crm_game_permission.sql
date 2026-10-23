-- ============================================================
-- Permission 'crm.monopoly' : accès à l'onglet Monopoly du CRM
-- (gamification des stats setters).
--
-- Cette migration CRÉE uniquement la permission, sans l'attribuer à
-- aucun rôle/service : l'attribution se fait via l'UI Rôles & Services
-- (roles_permissions / services_permissions), afin de laisser le choix
-- du rôle autorisé aux admins.
--
-- Côté front : l'onglet est masqué dans SinglePageCRM.tsx si
-- hasPermission('crm.monopoly') est faux (la donnée sous-jacente,
-- Event_calendar, reste protégée par ses propres RLS).
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

INSERT INTO public.permissions (code, label, category)
SELECT 'crm.monopoly', 'Accéder au Monopoly CRM (gamification setters)', 'crm'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'crm.monopoly'
);
