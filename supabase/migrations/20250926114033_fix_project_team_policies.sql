-- Fix project team membership policy recursion

set check_function_bodies = off;

-- Ensure helper runs with elevated privileges to avoid RLS recursion
create or replace function public.user_is_project_team_member(target_team uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_team_members m
    where m.team_id = target_team
      and m.user_id = target_user
  )
  or exists (
    select 1
    from public.project_teams t
    where t.id = target_team
      and t.owner_id = target_user
  );
$$;

-- Simplify the membership policy to rely on the helper function
alter table public.project_team_members drop policy if exists "Members can view team membership";
create policy "Members can view team membership"
  on public.project_team_members
  for select
  using (
    public.user_can_view_projects(auth.uid())
    and (
      public.user_is_project_team_member(project_team_members.team_id, auth.uid())
      or public.user_is_global_admin(auth.uid())
    )
  );
