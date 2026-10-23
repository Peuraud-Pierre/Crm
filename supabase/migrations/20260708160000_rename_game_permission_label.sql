-- ============================================================
-- Rebranding : le jeu « Monopoly CRM » devient « La Tournée »
-- (Monopoly est une marque déposée — aucun nom/visuel de la marque
-- ne doit apparaître dans l'application).
--
-- Seul le LIBELLÉ visible dans l'UI Rôles & Services change : le code
-- technique 'crm.monopoly' est conservé pour ne pas casser les
-- attributions roles_permissions/services_permissions existantes ni
-- les vérifications hasPermission() côté front.
--
-- Idempotent : UPDATE simple, ré-exécutable.
-- ============================================================

UPDATE public.permissions
SET label = 'Accéder à La Tournée (gamification setters)'
WHERE code = 'crm.monopoly';
