-- Allow global admins to update project status via a dedicated helper function

create or replace function public.update_project_status_as_admin(
  p_team_id uuid,
  p_status public.project_team_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_is_global_admin(auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.project_teams
  set status = p_status
  where id = p_team_id;
end;
$$;

revoke all on function public.update_project_status_as_admin(uuid, public.project_team_status) from public;
grant execute on function public.update_project_status_as_admin(uuid, public.project_team_status) to authenticated;

-- Synchronise role catalogue with new hierarchy
WITH updated_super_admin AS (
  UPDATE public.roles
  SET nom = 'Super Admin',
      permissions = jsonb_build_object(
        'messaging', jsonb_build_object('create_group', true, 'see_all_direct', true),
        'users', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true),
        'roles_services', jsonb_build_object('view', true, 'manage', true),
        'projects', jsonb_build_object('create', true, 'view_all', true)
      ),
      updated_at = now()
  WHERE regexp_replace(lower(coalesce(nom, '')), '\\s+', '', 'g') = 'superadmin'
  RETURNING 1
), updated_chef AS (
  UPDATE public.roles
  SET nom = 'Chef de service',
      permissions = jsonb_build_object(
        'messaging', jsonb_build_object('create_group', true, 'see_all_direct', true),
        'users', jsonb_build_object('view', true, 'create', false, 'update', false, 'delete', false),
        'roles_services', jsonb_build_object('view', true, 'manage', false),
        'projects', jsonb_build_object('create', true, 'view_all', false)
      ),
      updated_at = now()
  WHERE regexp_replace(lower(coalesce(nom, '')), '\\s+', '', 'g') IN ('admin', 'chefdeservice')
  RETURNING 1
), updated_employee AS (
  UPDATE public.roles
  SET nom = 'Employé',
      permissions = jsonb_build_object(
        'messaging', jsonb_build_object('create_group', false, 'see_all_direct', false),
        'users', jsonb_build_object('view', false, 'create', false, 'update', false, 'delete', false),
        'roles_services', jsonb_build_object('view', false, 'manage', false),
        'projects', jsonb_build_object('create', false, 'view_all', false)
      ),
      updated_at = now()
  WHERE regexp_replace(lower(coalesce(nom, '')), '\\s+', '', 'g') IN ('employe', 'employee')
  RETURNING 1
)
INSERT INTO public.roles (nom, permissions)
SELECT v.nom, v.permissions
FROM (VALUES
  ('Super Admin', jsonb_build_object(
    'messaging', jsonb_build_object('create_group', true, 'see_all_direct', true),
    'users', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true),
    'roles_services', jsonb_build_object('view', true, 'manage', true),
    'projects', jsonb_build_object('create', true, 'view_all', true)
  )),
  ('Chef de service', jsonb_build_object(
    'messaging', jsonb_build_object('create_group', true, 'see_all_direct', true),
    'users', jsonb_build_object('view', true, 'create', false, 'update', false, 'delete', false),
    'roles_services', jsonb_build_object('view', true, 'manage', false),
    'projects', jsonb_build_object('create', true, 'view_all', false)
  )),
  ('Employé', jsonb_build_object(
    'messaging', jsonb_build_object('create_group', false, 'see_all_direct', false),
    'users', jsonb_build_object('view', false, 'create', false, 'update', false, 'delete', false),
    'roles_services', jsonb_build_object('view', false, 'manage', false),
    'projects', jsonb_build_object('create', false, 'view_all', false)
  ))
) AS v(nom, permissions)
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE regexp_replace(lower(r.nom), '\\s+', '', 'g') = regexp_replace(lower(v.nom), '\\s+', '', 'g')
);

-- Align service catalogue with new departments
WITH normalized AS (
  SELECT id,
         regexp_replace(lower(nom), '\\s+', '', 'g') AS slug
  FROM public.services
), up_serv AS (
  UPDATE public.services s
  SET nom = m.nom,
      permissions = m.permissions,
      updated_at = now()
  FROM normalized n
  JOIN (
    VALUES
      ('direction', 'Direction', jsonb_build_object(
        'dashboard', true,
        'crm', true,
        'content', true,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', true,
        'projects', true
      )),
      ('tech', 'Tech', jsonb_build_object(
        'dashboard', true,
        'crm', true,
        'content', true,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', true,
        'roles_services', true,
        'profile', true,
        'matomo', true,
        'projects', true
      )),
      ('commercial', 'Commercial', jsonb_build_object(
        'dashboard', true,
        'crm', true,
        'content', true,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', false,
        'projects', true
      )),
      ('rh', 'RH', jsonb_build_object(
        'dashboard', true,
        'crm', false,
        'content', false,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', false,
        'projects', true
      )),
      ('marketing', 'Marketing', jsonb_build_object(
        'dashboard', true,
        'crm', false,
        'content', true,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', false,
        'projects', true
      )),
      ('pickers', 'Pickers', jsonb_build_object(
        'dashboard', true,
        'crm', false,
        'content', true,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', false,
        'projects', true
      )),
      ('economat', 'Economat', jsonb_build_object(
        'dashboard', true,
        'crm', false,
        'content', false,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', false,
        'projects', true
      )),
      ('compta', 'Compta', jsonb_build_object(
        'dashboard', true,
        'crm', true,
        'content', false,
        'messages', true,
        'tickets', true,
        'ping_pong', true,
        'users', true,
        'settings', false,
        'security', false,
        'roles_services', true,
        'profile', true,
        'matomo', false,
        'projects', true
      ))
  ) AS m(slug, nom, permissions) ON m.slug = n.slug
  WHERE s.id = n.id
  RETURNING 1
)
INSERT INTO public.services (nom, permissions)
SELECT m.nom, m.permissions
FROM (
  SELECT unnest(ARRAY[
    row('Direction', jsonb_build_object(
      'dashboard', true,
      'crm', true,
      'content', true,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', true,
      'projects', true
    )),
    row('Tech', jsonb_build_object(
      'dashboard', true,
      'crm', true,
      'content', true,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', true,
      'roles_services', true,
      'profile', true,
      'matomo', true,
      'projects', true
    )),
    row('Commercial', jsonb_build_object(
      'dashboard', true,
      'crm', true,
      'content', true,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', false,
      'projects', true
    )),
    row('RH', jsonb_build_object(
      'dashboard', true,
      'crm', false,
      'content', false,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', false,
      'projects', true
    )),
    row('Marketing', jsonb_build_object(
      'dashboard', true,
      'crm', false,
      'content', true,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', false,
      'projects', true
    )),
    row('Pickers', jsonb_build_object(
      'dashboard', true,
      'crm', false,
      'content', true,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', false,
      'projects', true
    )),
    row('Economat', jsonb_build_object(
      'dashboard', true,
      'crm', false,
      'content', false,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', false,
      'projects', true
    )),
    row('Compta', jsonb_build_object(
      'dashboard', true,
      'crm', true,
      'content', false,
      'messages', true,
      'tickets', true,
      'ping_pong', true,
      'users', true,
      'settings', false,
      'security', false,
      'roles_services', true,
      'profile', true,
      'matomo', false,
      'projects', true
    ))
  ]) AS t(nom txt, permissions jsonb)
) AS m
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s WHERE regexp_replace(lower(s.nom), '\\s+', '', 'g') = regexp_replace(lower(m.nom), '\\s+', '', 'g')
);

-- Helper functions for role & service logic
create or replace function public.role_slug(role_name text)
returns text
language sql
stable
as $$
  select case
    when role_name is null then ''
    else regexp_replace(
      translate(lower(role_name), 'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ', 'aaaaaaacceeeeiiiinooooouuuuyyoe'),
      '[^a-z0-9]',
      '',
      'g'
    )
  end;
$$;

create or replace function public.service_slug(service_name text)
returns text
language sql
stable
as $$
  select case
    when service_name is null then ''
    else regexp_replace(
      translate(lower(service_name), 'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ', 'aaaaaaacceeeeiiiinooooouuuuyyoe'),
      '[^a-z0-9]',
      '',
      'g'
    )
  end;
$$;

create or replace function public.user_role_and_service(target_user uuid default auth.uid())
returns table(role_slug text, service_slug text)
language sql
stable
as $$
  select
    public.role_slug(r.nom),
    public.service_slug(s.nom)
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join public.services s on s.id = p.service_id
  where p.user_id = target_user;
$$;

create or replace function public.user_service_slug(target_user uuid default auth.uid())
returns text
language sql
stable
as $$
  select service_slug from public.user_role_and_service(target_user) limit 1;
$$;

create or replace function public.project_owner_service_slug(team_id uuid)
returns text
language sql
stable
as $$
  select public.service_slug(s.nom)
  from public.project_teams t
  left join public.profiles owner on owner.user_id = t.owner_id
  left join public.services s on s.id = owner.service_id
  where t.id = team_id;
$$;

create or replace function public.user_is_global_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select coalesce((select role_slug = 'superadmin' from public.user_role_and_service(target_user) limit 1), false);
$$;

create or replace function public.user_is_service_manager(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select coalesce((select role_slug in ('superadmin', 'chefdeservice') from public.user_role_and_service(target_user) limit 1), false);
$$;

create or replace function public.user_can_manage_projects(target_user uuid default auth.uid())
returns boolean
language plpgsql
stable
as $$
declare
  v_role text;
  v_service text;
begin
  select role_slug, service_slug into v_role, v_service
  from public.user_role_and_service(target_user)
  limit 1;

  if v_role = 'superadmin' then
    return true;
  end if;

  if v_role = 'chefdeservice' then
    if v_service = 'direction' then
      return false;
    end if;
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.user_can_create_projects(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select public.user_can_manage_projects(target_user);
$$;

create or replace function public.user_can_access_project(team_id uuid, target_user uuid default auth.uid())
returns boolean
language plpgsql
stable
as $$
declare
  v_role text;
  v_service text;
  project_service text;
begin
  if public.user_is_global_admin(target_user) then
    return true;
  end if;

  select role_slug, service_slug into v_role, v_service
  from public.user_role_and_service(target_user)
  limit 1;

  if v_service = 'direction' then
    return true;
  end if;

  if public.user_is_project_team_member(team_id, target_user) then
    return true;
  end if;

  select coalesce(public.project_owner_service_slug(team_id), '') into project_service;

  if v_role = 'chefdeservice' then
    if v_service = 'tech' then
      return true;
    end if;
    return project_service = v_service;
  end if;

  return false;
end;
$$;

create or replace function public.user_can_view_projects(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.project_teams t
    where public.user_can_access_project(t.id, target_user)
  );
$$;

create or replace function public.user_has_project_service(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select coalesce((select service_slug <> '' from public.user_role_and_service(target_user) limit 1), false);
$$;

-- Reapply project policies with new helper functions
drop policy if exists "Project team members can view teams" on public.project_teams;
create policy "Project team members can view teams"
  on public.project_teams
  for select
  using (
    public.user_can_access_project(id, auth.uid())
  );

drop policy if exists "Authenticated users can create teams they own" on public.project_teams;
create policy "Authenticated users can create teams they own"
  on public.project_teams
  for insert
  with check (
    owner_id = auth.uid()
    and public.user_can_create_projects(auth.uid())
  );

drop policy if exists "Members can view team membership" on public.project_team_members;
create policy "Members can view team membership"
  on public.project_team_members
  for select
  using (
    auth.uid() = user_id
    or public.user_is_global_admin(auth.uid())
    or (
      public.user_is_service_manager(auth.uid())
      and (
        public.user_service_slug(auth.uid()) = 'tech'
        or public.user_service_slug(auth.uid()) = public.project_owner_service_slug(team_id)
      )
    )
  );

drop policy if exists "Owners can add members to their team" on public.project_team_members;
create policy "Managers can add members"
  on public.project_team_members
  for insert
  with check (
    public.user_can_manage_projects(auth.uid())
    and (
      public.user_service_slug(auth.uid()) = 'tech'
      or public.user_service_slug(auth.uid()) = public.project_owner_service_slug(team_id)
    )
    and public.user_has_project_service(user_id)
  );

drop policy if exists "Owners can update member roles" on public.project_team_members;
create policy "Managers can update members"
  on public.project_team_members
  for update
  using (
    public.user_can_manage_projects(auth.uid())
    and (
      public.user_service_slug(auth.uid()) = 'tech'
      or public.user_service_slug(auth.uid()) = public.project_owner_service_slug(team_id)
    )
  )
  with check (
    public.user_can_manage_projects(auth.uid())
    and (
      public.user_service_slug(auth.uid()) = 'tech'
      or public.user_service_slug(auth.uid()) = public.project_owner_service_slug(team_id)
    )
  );

drop policy if exists "Members or owners can remove memberships" on public.project_team_members;
create policy "Members or managers can remove memberships"
  on public.project_team_members
  for delete
  using (
    auth.uid() = user_id
    or (
      public.user_can_manage_projects(auth.uid())
      and (
        public.user_service_slug(auth.uid()) = 'tech'
        or public.user_service_slug(auth.uid()) = public.project_owner_service_slug(team_id)
      )
    )
  );

drop policy if exists "Team members can view sprints" on public.project_sprints;
create policy "Team members can view sprints"
  on public.project_sprints
  for select
  using (
    public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Team members can create sprints" on public.project_sprints;
create policy "Team members can create sprints"
  on public.project_sprints
  for insert
  with check (
    public.user_can_access_project(team_id, auth.uid())
    and (
      public.user_is_project_team_member(team_id, auth.uid())
      or public.user_can_manage_projects(auth.uid())
    )
  );

drop policy if exists "Team members can update sprints" on public.project_sprints;
create policy "Team members can update sprints"
  on public.project_sprints
  for update
  using (
    public.user_can_access_project(team_id, auth.uid())
  )
  with check (
    public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Team owners can delete sprints" on public.project_sprints;
create policy "Team owners can delete sprints"
  on public.project_sprints
  for delete
  using (
    public.user_can_manage_projects(auth.uid())
    and public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Team members can view tasks" on public.project_tasks;
create policy "Team members can view tasks"
  on public.project_tasks
  for select
  using (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
    )
  );

drop policy if exists "Team members can create tasks" on public.project_tasks;
create policy "Team members can create tasks"
  on public.project_tasks
  for insert
  with check (
    exists (
      select 1
      from public.project_sprints s
      where s.id = sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
        and public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

drop policy if exists "Team members can update tasks" on public.project_tasks;
create policy "Team members can update tasks"
  on public.project_tasks
  for update
  using (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
        and public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

drop policy if exists "Team members can delete tasks" on public.project_tasks;
create policy "Team members can delete tasks"
  on public.project_tasks
  for delete
  using (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
        and public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

drop policy if exists "Members can view team membership" on public.project_team_members;
create policy "Members can view team membership"
  on public.project_team_members
  for select
  using (
    public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Owners can add members to their team" on public.project_team_members;
create policy "Managers can add members"
  on public.project_team_members
  for insert
  with check (
    public.user_can_manage_projects(auth.uid())
    and public.user_can_access_project(team_id, auth.uid())
    and public.user_has_project_service(user_id)
  );

drop policy if exists "Owners can update member roles" on public.project_team_members;
create policy "Managers can update members"
  on public.project_team_members
  for update
  using (
    public.user_can_manage_projects(auth.uid())
    and public.user_can_access_project(team_id, auth.uid())
  )
  with check (
    public.user_can_manage_projects(auth.uid())
    and public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Members or owners can remove memberships" on public.project_team_members;
create policy "Members or managers can remove memberships"
  on public.project_team_members
  for delete
  using (
    auth.uid() = user_id
    or (
      public.user_can_manage_projects(auth.uid())
      and public.user_can_access_project(team_id, auth.uid())
    )
  );

drop policy if exists "Team members can view sprints" on public.project_sprints;
create policy "Team members can view sprints"
  on public.project_sprints
  for select
  using (
    public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Team members can create sprints" on public.project_sprints;
create policy "Team members can create sprints"
  on public.project_sprints
  for insert
  with check (
    public.user_can_access_project(team_id, auth.uid())
    and (
      public.user_is_project_team_member(team_id, auth.uid())
      or public.user_can_manage_projects(auth.uid())
    )
  );

drop policy if exists "Team members can update sprints" on public.project_sprints;
create policy "Team members can update sprints"
  on public.project_sprints
  for update
  using (
    public.user_can_access_project(team_id, auth.uid())
  )
  with check (
    public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Team owners can delete sprints" on public.project_sprints;
create policy "Team owners can delete sprints"
  on public.project_sprints
  for delete
  using (
    public.user_can_manage_projects(auth.uid())
    and public.user_can_access_project(team_id, auth.uid())
  );

drop policy if exists "Team members can view tasks" on public.project_tasks;
create policy "Team members can view tasks"
  on public.project_tasks
  for select
  using (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
    )
  );

drop policy if exists "Team members can create tasks" on public.project_tasks;
create policy "Team members can create tasks"
  on public.project_tasks
  for insert
  with check (
    exists (
      select 1
      from public.project_sprints s
      where s.id = sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
        and public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

drop policy if exists "Team members can update tasks" on public.project_tasks;
create policy "Team members can update tasks"
  on public.project_tasks
  for update
  using (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
        and public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

drop policy if exists "Team members can delete tasks" on public.project_tasks;
create policy "Team members can delete tasks"
  on public.project_tasks
  for delete
  using (
    exists (
      select 1
      from public.project_sprints s
      where s.id = project_tasks.sprint_id
        and public.user_can_access_project(s.team_id, auth.uid())
        and public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );
