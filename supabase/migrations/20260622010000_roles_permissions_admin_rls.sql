-- ============================================================
-- RLS : permettre aux administrateurs globaux de GÉRER les attributions de
-- permissions (tables roles_permissions / services_permissions).
--
-- Problème : l'UI de gestion des rôles fait un INSERT direct dans
-- public.roles_permissions, mais la RLS active n'a aucune policy d'écriture
-- → "new row violates row-level security policy" (42501).
--
-- Solution : s'appuyer sur la fonction existante public.user_is_global_admin()
-- (rôle 'admin' / 'superadmin') pour autoriser l'écriture aux admins.
--
-- Une policy FOR ALL est combinée en OR avec les policies SELECT existantes :
-- les lectures actuelles (calcul des permissions) restent donc inchangées ;
-- on n'ajoute QUE le droit d'écriture pour les administrateurs globaux.
--
-- Idempotent : DROP POLICY IF EXISTS avant CREATE.
-- ============================================================

ALTER TABLE public.roles_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_permissions_admin_write ON public.roles_permissions;
CREATE POLICY roles_permissions_admin_write
    ON public.roles_permissions FOR ALL
    TO authenticated
    USING (public.user_is_global_admin())
    WITH CHECK (public.user_is_global_admin());

DROP POLICY IF EXISTS services_permissions_admin_write ON public.services_permissions;
CREATE POLICY services_permissions_admin_write
    ON public.services_permissions FOR ALL
    TO authenticated
    USING (public.user_is_global_admin())
    WITH CHECK (public.user_is_global_admin());
