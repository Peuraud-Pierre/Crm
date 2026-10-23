-- ============================================================
-- Fix : has_permission(code) ne couvrait QUE le service.
--
-- La fonction mono-argument public.has_permission(text) — utilisée
-- dans la majorité des policies RLS (crm.view, log.view, stock.*,
-- users.view, veille.*, manager.console, newsletter.*, ...) — ne
-- testait que public.services_permissions. Résultat : une permission
-- accordée par le ROLE ou en INDIVIDUEL (public.users_permissions)
-- était ignorée par toutes ces policies.
--
-- La logique complète (rôle OU service OU individuel) vit déjà dans
-- public.user_has_permission(uid, code). On fait donc de
-- has_permission un simple alias qui délègue, pour garder UNE SEULE
-- source de vérité. Aucune policy à retoucher.
--
-- Attributs conservés à l'identique (STABLE, SECURITY DEFINER,
-- search_path='') : le pattern (SELECT has_permission(...)) des
-- migrations de perf reste un InitPlan évalué une seule fois.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.user_has_permission((select auth.uid()), permission_code);
$function$;
