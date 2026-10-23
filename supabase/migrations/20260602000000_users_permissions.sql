-- ============================================================
-- Permissions individuelles par utilisateur
--
-- Permet d'octroyer une permission à un utilisateur précis, EN PLUS
-- de ce qu'il hérite de son rôle / service. Sémantique additive seule
-- (on ne révoque jamais un droit hérité par ce biais).
--
-- Calqué sur public.roles_permissions / public.services_permissions.
-- ============================================================

-- ------------------------------------------------------------
-- Table de jonction
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_permissions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL,                  -- = profiles.user_id (auth.uid)
    permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS users_permissions_user_id_idx
    ON public.users_permissions (user_id);

-- ------------------------------------------------------------
-- RLS : gestion réservée aux porteurs de 'users.update' ;
--       chacun peut lire ses propres permissions.
-- ------------------------------------------------------------
ALTER TABLE public.users_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own individual permissions" ON public.users_permissions;
CREATE POLICY "Users can view their own individual permissions"
    ON public.users_permissions FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.user_has_permission(auth.uid(), 'users.update')
    );

DROP POLICY IF EXISTS "Users with users.update can grant individual permissions" ON public.users_permissions;
CREATE POLICY "Users with users.update can grant individual permissions"
    ON public.users_permissions FOR INSERT
    WITH CHECK (public.user_has_permission(auth.uid(), 'users.update'));

DROP POLICY IF EXISTS "Users with users.update can revoke individual permissions" ON public.users_permissions;
CREATE POLICY "Users with users.update can revoke individual permissions"
    ON public.users_permissions FOR DELETE
    USING (public.user_has_permission(auth.uid(), 'users.update'));

-- ------------------------------------------------------------
-- Helper : ajoute la branche "permission individuelle" à
-- public.user_has_permission (rôle OU service OU individuelle).
-- Même signature -> les RLS existantes en bénéficient automatiquement.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_permission(p_uid uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.roles_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.user_id = p_uid
      AND p.code = p_code
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.services_permissions sp ON sp.service_id = pr.service_id
    JOIN public.permissions p ON p.id = sp.permission_id
    WHERE pr.user_id = p_uid
      AND p.code = p_code
  )
  OR EXISTS (
    SELECT 1
    FROM public.users_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_uid
      AND p.code = p_code
  );
$$;

-- ------------------------------------------------------------
-- RPC : ajoute la branche "permission individuelle" à
-- public.get_user_permissions (codes fusionnés, dédupliqués).
--
-- Reprise à l'identique de la définition en production (récupérée via
-- pg_get_functiondef) : pas de SECURITY DEFINER, SET search_path TO ''.
-- Seul le 3e SELECT (users_permissions) est ajouté.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permissions(uid uuid)
 RETURNS TABLE(code text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  -- Permissions liées au rôle
  select distinct p.code
  from public.profiles pr
  join public.roles_permissions rp on rp.role_id = pr.role_id
  join public.permissions p on p.id = rp.permission_id
  where pr.user_id = uid

  union

  -- Permissions liées au service
  select distinct p.code
  from public.profiles pr
  join public.services_permissions sp on sp.service_id = pr.service_id
  join public.permissions p on p.id = sp.permission_id
  where pr.user_id = uid

  union

  -- Permissions individuelles
  select distinct p.code
  from public.users_permissions up
  join public.permissions p on p.id = up.permission_id
  where up.user_id = uid;
$function$;
