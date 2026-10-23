-- ============================================================
-- Fix 54001 "stack depth limit exceeded" sur /projects (fetchBoards)
--
-- Deux boucles RLS, aucune fonction en SECURITY DEFINER :
--
--   [1] policy SELECT project_teams = user_can_access_project(id)
--       -> project_owner_service_slug(team_id) lit project_teams
--       -> policy SELECT project_teams -> ...
--
--   [2] user_can_access_project -> user_is_project_team_member
--       -> lit project_team_members
--       -> policy SELECT project_team_members -> project_owner_service_slug
--       -> lit project_teams -> policy -> user_can_access_project -> ...
--
-- Le planner inline et déduplique tant que l'arbre reste petit ;
-- fetchBoards (4 niveaux d'embed PostgREST) le fait déborder.
--
-- Fix : SECURITY DEFINER sur les 4 fonctions FEUILLES, celles qui
-- touchent réellement une table protégée. La RLS ne s'applique plus
-- à l'intérieur -> les deux cycles sont coupés à la racine.
-- Les fonctions appelantes (user_can_access_project,
-- user_can_manage_projects, user_is_global_admin, user_service_slug...)
-- n'accèdent aux tables qu'à travers elles : rien à y changer.
--
-- ALTER plutôt que CREATE OR REPLACE : le schéma en base a dérivé des
-- migrations (corps modifiés à la main). On ne touche pas aux corps.
--
-- Toutes retournent un booléen ou un slug, jamais de lignes :
-- aucune fuite de données via l'élévation de privilèges.
-- ============================================================

ALTER FUNCTION public.user_role_and_service(uuid)
  SECURITY DEFINER SET search_path TO '';

ALTER FUNCTION public.project_owner_service_slug(uuid)
  SECURITY DEFINER SET search_path TO '';

ALTER FUNCTION public.user_is_project_team_member(uuid, uuid)
  SECURITY DEFINER SET search_path TO '';

ALTER FUNCTION public.user_can_view_projects(uuid)
  SECURITY DEFINER SET search_path TO '';

-- Vérification (doit renvoyer 4 lignes en prosecdef = true) :
--   select proname, prosecdef, proconfig from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('user_role_and_service','project_owner_service_slug',
--                     'user_is_project_team_member','user_can_view_projects');
