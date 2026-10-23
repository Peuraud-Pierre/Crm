-- ============================================================
-- Recalage des migrations sur l'état réel de la production.
--
-- Le schéma projet en prod a divergé des migrations : corps de
-- fonctions modifiés au SQL editor, pattern de perf `(select auth.uid())`
-- appliqué à la main sur toutes les policies, et 3 policies
-- project_teams (INSERT/UPDATE/DELETE) qui n'existent dans aucune
-- migration. Conséquence : `supabase db reset` ne reproduit pas la
-- prod — c'est ce qui avait déjà annulé le SECURITY DEFINER posé en
-- septembre 2025 (09814402) et ramené la récursion RLS corrigée par
-- 20260824120000.
--
-- Ce fichier redéclare l'état de prod, à une correction près (§2).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fonctions — état de prod à l'identique.
--    SECURITY DEFINER conservé sur les 4 feuilles (cf.
--    20260824120000) : elles lisent des tables dont les policies
--    les rappellent. Ne pas le retirer sans relire ce fichier.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.role_slug(role_name text)
RETURNS text LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select case
    when role_name is null then ''
    else regexp_replace(
      translate(lower(role_name),
        'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ',
        'aaaaaaacceeeeiiiinooooouuuuyyoe'),
      '[^a-z0-9]', '', 'g'
    )
  end;
$function$;

CREATE OR REPLACE FUNCTION public.service_slug(service_name text)
RETURNS text LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select case
    when service_name is null then ''
    else regexp_replace(
      translate(lower(service_name),
        'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ',
        'aaaaaaacceeeeiiiinooooouuuuyyoe'),
      '[^a-z0-9]', '', 'g'
    )
  end;
$function$;

-- Feuille : lit profiles/roles/services -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.user_role_and_service(target_user uuid DEFAULT auth.uid())
RETURNS TABLE(role_slug text, service_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select public.role_slug(r.nom), public.service_slug(s.nom)
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join public.services s on s.id = p.service_id
  where p.user_id = target_user;
$function$;

-- Feuille : lit project_teams -> SECURITY DEFINER (cycle [1])
CREATE OR REPLACE FUNCTION public.project_owner_service_slug(team_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select public.service_slug(s.nom)
  from public.project_teams t
  left join public.profiles owner on owner.user_id = t.owner_id
  left join public.services s on s.id = owner.service_id
  where t.id = team_id;
$function$;

-- Feuille : lit project_team_members + project_teams -> SECURITY DEFINER (cycle [2])
CREATE OR REPLACE FUNCTION public.user_is_project_team_member(target_team uuid, target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_team_members m
    WHERE m.team_id = target_team AND m.user_id = target_user
  )
  OR EXISTS (
    SELECT 1 FROM public.project_teams t
    WHERE t.id = target_team AND t.owner_id = target_user
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_service_slug(target_user uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT service_slug FROM public.user_role_and_service(target_user) LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.user_is_global_admin(target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.user_role_and_service(target_user)
    where role_slug = 'superadmin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_is_service_manager(target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select coalesce((
    select role_slug in ('superadmin', 'chefdeservice')
    from public.user_role_and_service(target_user)
    limit 1
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.user_has_project_service(target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT COALESCE((
    SELECT service_slug <> ''
    FROM public.user_role_and_service(target_user) LIMIT 1
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.user_can_manage_projects(target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_service text;
BEGIN
  SELECT role_slug, service_slug INTO v_role, v_service
  FROM public.user_role_and_service(target_user)
  LIMIT 1;

  IF v_role = 'superadmin' THEN RETURN true; END IF;

  IF v_role = 'chefdeservice' THEN
    IF v_service = 'direction' THEN RETURN false; END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_can_create_projects(target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT public.user_can_manage_projects(target_user);
$function$;

CREATE OR REPLACE FUNCTION public.user_can_access_project(team_id uuid, target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_service text;
  project_service text;
BEGIN
  IF public.user_is_global_admin(target_user) THEN RETURN true; END IF;

  SELECT role_slug, service_slug INTO v_role, v_service
  FROM public.user_role_and_service(target_user)
  LIMIT 1;

  IF v_service = 'tech' THEN RETURN true; END IF;
  IF v_service = 'direction' THEN RETURN true; END IF;

  IF public.user_is_project_team_member(team_id, target_user) THEN RETURN true; END IF;

  SELECT COALESCE(public.project_owner_service_slug(team_id), '')
  INTO project_service;

  IF v_role = 'chefdeservice' THEN
    RETURN project_service = v_service;
  END IF;

  RETURN false;
END;
$function$;

-- Feuille : lit project_teams -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.user_can_view_projects(target_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_teams t
    WHERE public.user_can_access_project(t.id, target_user)
  );
$function$;

CREATE OR REPLACE FUNCTION public.update_project_status_as_admin(p_team_id uuid, p_status public.project_team_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if not public.user_is_global_admin(auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.project_teams
  set status = p_status
  where id = p_team_id;
end;
$function$;

-- ------------------------------------------------------------
-- 2. CORRECTION — project_teams UPDATE/DELETE.
--
-- Les deux policies (créées hors migration) testaient :
--     owner_id = (SELECT p.user_id FROM profiles p WHERE p.id = auth.uid())
-- Or `profiles.id` est une PK `gen_random_uuid()` distincte de
-- `profiles.user_id` (= auth.users.id) : le sous-select ne matche
-- jamais et renvoie NULL.
--   - UPDATE : `NULL AND user_can_manage_projects(...)` -> jamais vrai.
--     Aucun UPDATE de project_teams ne passe par PostgREST, quel que
--     soit l'utilisateur. C'est ce que contourne le fallback RPC de
--     services/project/updateProjectStatus.ts (réservé aux superadmins)
--     -> un chef de service ne peut pas archiver son propre projet.
--   - DELETE : sauvé par les OR, mais la branche owner est morte.
--
-- `project_teams.owner_id` contient déjà un auth uid (cf. policies
-- SELECT/INSERT qui font `owner_id = auth.uid()`) : le sous-select
-- sur profiles était inutile autant qu'incorrect.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Only team owners can update teams" ON public.project_teams;
CREATE POLICY "Only team owners can update teams"
  ON public.project_teams
  FOR UPDATE
  USING (
    (owner_id = (select auth.uid()))
    AND user_can_manage_projects((select auth.uid()))
  )
  WITH CHECK (
    (owner_id = (select auth.uid()))
    AND user_can_manage_projects((select auth.uid()))
  );

DROP POLICY IF EXISTS "Enable delete for owners or admins" ON public.project_teams;
CREATE POLICY "Enable delete for owners or admins"
  ON public.project_teams
  FOR DELETE
  USING (
    (owner_id = (select auth.uid()))
    OR (select user_can_manage_projects((select auth.uid())))
    OR (select user_is_global_admin((select auth.uid())))
  );

-- ------------------------------------------------------------
-- 3. Policies restantes — état de prod à l'identique.
--    Reprises telles quelles : elles sont correctes, mais aucune
--    migration ne les reproduisait (pattern `(select auth.uid())`
--    appliqué à la main, et la policy SELECT de project_team_members
--    est en prod la variante `user_service_slug` alors que
--    20250304121500 la termine sur `user_can_access_project`).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Project team members can view teams" ON public.project_teams;
CREATE POLICY "Project team members can view teams"
  ON public.project_teams FOR SELECT
  USING (user_can_access_project(id, (select auth.uid())));

DROP POLICY IF EXISTS "Members can view team membership" ON public.project_team_members;
CREATE POLICY "Members can view team membership"
  ON public.project_team_members FOR SELECT
  USING (
    ((select auth.uid()) = user_id)
    OR (select user_is_global_admin((select auth.uid())))
    OR (
      (select user_can_manage_projects((select auth.uid())))
      AND (
        user_service_slug((select auth.uid())) = 'tech'
        OR user_service_slug((select auth.uid())) = project_owner_service_slug(team_id)
      )
    )
  );

DROP POLICY IF EXISTS "Managers can add members" ON public.project_team_members;
CREATE POLICY "Managers can add members"
  ON public.project_team_members FOR INSERT
  WITH CHECK (
    user_can_manage_projects((select auth.uid()))
    AND (
      user_service_slug((select auth.uid())) = 'tech'
      OR user_service_slug((select auth.uid())) = project_owner_service_slug(team_id)
    )
    AND user_has_project_service(user_id)
  );

DROP POLICY IF EXISTS "Managers can update members" ON public.project_team_members;
CREATE POLICY "Managers can update members"
  ON public.project_team_members FOR UPDATE
  USING (
    user_can_manage_projects((select auth.uid()))
    AND (
      user_service_slug((select auth.uid())) = 'tech'
      OR user_service_slug((select auth.uid())) = project_owner_service_slug(team_id)
    )
  )
  WITH CHECK (
    user_can_manage_projects((select auth.uid()))
    AND (
      user_service_slug((select auth.uid())) = 'tech'
      OR user_service_slug((select auth.uid())) = project_owner_service_slug(team_id)
    )
  );

DROP POLICY IF EXISTS "Members or managers can remove memberships" ON public.project_team_members;
CREATE POLICY "Members or managers can remove memberships"
  ON public.project_team_members FOR DELETE
  USING (
    ((select auth.uid()) = user_id)
    OR (
      user_can_manage_projects((select auth.uid()))
      AND (
        user_service_slug((select auth.uid())) = 'tech'
        OR user_service_slug((select auth.uid())) = project_owner_service_slug(team_id)
      )
    )
  );

DROP POLICY IF EXISTS "Team members can view sprints" ON public.project_sprints;
CREATE POLICY "Team members can view sprints"
  ON public.project_sprints FOR SELECT
  USING (user_can_access_project(team_id, (select auth.uid())));

DROP POLICY IF EXISTS "Team members can create sprints" ON public.project_sprints;
CREATE POLICY "Team members can create sprints"
  ON public.project_sprints FOR INSERT
  WITH CHECK (
    user_can_access_project(team_id, (select auth.uid()))
    AND (
      user_is_project_team_member(team_id, (select auth.uid()))
      OR user_can_manage_projects((select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Team members can update sprints" ON public.project_sprints;
CREATE POLICY "Team members can update sprints"
  ON public.project_sprints FOR UPDATE
  USING (user_can_access_project(team_id, (select auth.uid())))
  WITH CHECK (user_can_access_project(team_id, (select auth.uid())));

DROP POLICY IF EXISTS "Team owners can delete sprints" ON public.project_sprints;
CREATE POLICY "Team owners can delete sprints"
  ON public.project_sprints FOR DELETE
  USING (
    user_can_manage_projects((select auth.uid()))
    AND user_can_access_project(team_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Team members can view tasks" ON public.project_tasks;
CREATE POLICY "Team members can view tasks"
  ON public.project_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND user_can_access_project(s.team_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Team members can create tasks" ON public.project_tasks;
CREATE POLICY "Team members can create tasks"
  ON public.project_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND user_can_access_project(s.team_id, (select auth.uid()))
        AND user_is_project_team_member(s.team_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Team members can update tasks" ON public.project_tasks;
CREATE POLICY "Team members can update tasks"
  ON public.project_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND user_can_access_project(s.team_id, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND user_can_access_project(s.team_id, (select auth.uid()))
        AND user_is_project_team_member(s.team_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Team members can delete tasks" ON public.project_tasks;
CREATE POLICY "Team members can delete tasks"
  ON public.project_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND user_can_access_project(s.team_id, (select auth.uid()))
        AND user_is_project_team_member(s.team_id, (select auth.uid()))
    )
  );

-- ------------------------------------------------------------
-- 4. SUPPRESSION — branche IT de la policy INSERT project_teams.
--
-- La policy INSERT portait en prod (hors migration) une branche
--     OR user_has_it_project_creation_rights(auth.uid())
-- dont la fonction est doublement cassée :
--   - son paramètre s'appelle `user_id`, comme la colonne
--     `profiles.user_id` qu'elle compare (`where p.user_id = user_id`) ;
--   - elle filtre sur service 'IT' et rôles 'Admin'/'Super Admin',
--     référentiel disparu depuis le renommage du catalogue par
--     20250304121500 ('Tech', 'Super Admin', 'Chef de service').
--
-- Vérifié avant suppression : aucun profil ne satisfait
-- (service 'IT' AND rôle 'Admin'/'Super Admin') -> la fonction renvoie
-- false pour tout le monde, quelle que soit la façon dont PostgreSQL
-- tranche l'ambiguïté du paramètre. La branche est morte : la retirer
-- ne retire aucun droit réellement exercé aujourd'hui, et referme le
-- risque d'ouverture massive si un service 'IT' venait à être recréé.
--
-- `user_can_create_projects` (superadmin + chef de service hors
-- direction) reste la seule voie de création.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can create teams they own" ON public.project_teams;
CREATE POLICY "Authenticated users can create teams they own"
  ON public.project_teams FOR INSERT
  WITH CHECK (
    (owner_id = (select auth.uid()))
    AND user_can_create_projects((select auth.uid()))
  );

DROP FUNCTION IF EXISTS public.user_has_it_project_creation_rights(uuid);

-- ------------------------------------------------------------
-- Contrôles après application :
--
-- 1) Les 4 feuilles restent SECURITY DEFINER :
--   select proname, prosecdef from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('user_role_and_service','project_owner_service_slug',
--                     'user_is_project_team_member','user_can_view_projects');
--
-- 2) L'UPDATE owner redevient possible (à exécuter sous un JWT de chef
--    de service propriétaire d'un projet, pas en service_role) :
--   update public.project_teams set status = status
--   where id = '<un projet dont il est owner>' returning id;
--   -- doit renvoyer 1 ligne ; renvoyait 0 avant ce fichier.
-- ------------------------------------------------------------
--
-- 3) La fonction morte a disparu (doit renvoyer 0 ligne) :
--   select proname from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname = 'user_has_it_project_creation_rights';
--
-- Après application : régénérer src/integrations/supabase/types.ts
-- (la fonction supprimée y figure encore).
-- ------------------------------------------------------------
