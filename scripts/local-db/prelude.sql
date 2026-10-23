-- Fonctions créées à la main dans le dashboard Supabase de prod, jamais
-- versionnées dans supabase/migrations. Reconstituées pour la base locale.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- Vrai si la session courante a passé le second facteur (TOTP).
create or replace function public.auth_session_is_aal2() returns boolean
language sql stable as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;
grant execute on function public.auth_session_is_aal2() to anon, authenticated;

-- Rôle Postgres utilisé par une policy de prod (service de génération de contenu).
do $$ begin create role content_generation nologin; exception when duplicate_object then null; end $$;

-- Utilisée par les policies consolidées (rls_advisor_cleanup).
create or replace function public.check_is_super_admin_global() returns boolean
language plpgsql stable security definer set search_path = public
as $$ begin return public.user_is_global_admin(auth.uid()); end $$;

-- Reconstitution : admin (ou super admin) rattaché au service ciblé.
create or replace function public.check_is_service_admin(target_service_id uuid) returns boolean
language plpgsql stable security definer set search_path = public
as $$ begin
  return exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and p.service_id = target_service_id
      and public.role_slug(r.nom) in ('admin', 'superadmin'));
end $$;
