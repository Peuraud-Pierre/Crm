-- Align role-based helper functions with slug-style comparisons used in the app

create or replace function public.role_slug(role_name text)
returns text
language sql
stable
as $$
  select case
    when role_name is null then ''
    else regexp_replace(lower(role_name), '\\s+', '', 'g')
  end;
$$;

create or replace function public.user_is_global_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select regexp_replace(lower(coalesce(r.nom, '')), '\\s+', '', 'g') = any (array['superadmin', 'admin'])
      from public.profiles p
      left join public.roles r on r.id = p.role_id
      where p.user_id = target_user
    ),
    false
  );
$$;

create or replace function public.user_can_manage_projects(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select
        public.user_has_project_service(target_user)
        and regexp_replace(lower(coalesce(r.nom, '')), '\\s+', '', 'g') = any (array['superadmin', 'admin', 'chefdeservice'])
      from public.profiles p
      left join public.roles r on r.id = p.role_id
      where p.user_id = target_user
    ),
    false
  );
$$;
