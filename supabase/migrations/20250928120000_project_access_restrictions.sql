-- Tighten project access to IT service and define role-based capabilities

CREATE OR REPLACE FUNCTION public.user_has_project_service(target_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(COALESCE(s.permissions->>'projects', 'false')::boolean, false)
      FROM public.profiles p
      LEFT JOIN public.services s ON s.id = p.service_id
      WHERE p.user_id = target_user
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_global_admin(target_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT LOWER(COALESCE(r.nom, '')) = ANY (ARRAY['superadmin', 'admin'])
      FROM public.profiles p
      LEFT JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = target_user
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_projects(target_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.user_has_project_service(target_user)
    OR public.user_is_global_admin(target_user);
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_projects(target_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT
        public.user_has_project_service(target_user)
        AND LOWER(COALESCE(r.nom, '')) = ANY (ARRAY['superadmin', 'admin', 'chef de service'])
      FROM public.profiles p
      LEFT JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = target_user
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_project_team_member(target_team uuid, target_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_team_members m
    WHERE m.team_id = target_team
      AND m.user_id = target_user
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_teams t
    WHERE t.id = target_team
      AND t.owner_id = target_user
  );
$$;

-- Restrict projects permission to IT service by default
UPDATE public.services
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{projects}',
  CASE
    WHEN LOWER(nom) = 'it' THEN 'true'::jsonb
    ELSE 'false'::jsonb
  END,
  true
);

-- Recreate policies for project_teams
DROP POLICY IF EXISTS "Project team members can view teams" ON public.project_teams;
CREATE POLICY "Project team members can view teams"
  ON public.project_teams
  FOR SELECT
  USING (
    public.user_can_view_projects(auth.uid())
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.project_team_members m
        WHERE m.team_id = project_teams.id
          AND m.user_id = auth.uid()
      )
      OR public.user_is_global_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create teams they own" ON public.project_teams;
CREATE POLICY "Authenticated users can create teams they own"
  ON public.project_teams
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND public.user_can_manage_projects(auth.uid())
  );

DROP POLICY IF EXISTS "Only team owners can update teams" ON public.project_teams;
CREATE POLICY "Only team owners can update teams"
  ON public.project_teams
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    AND public.user_can_manage_projects(auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND public.user_can_manage_projects(auth.uid())
  );

DROP POLICY IF EXISTS "Only team owners can delete teams" ON public.project_teams;
CREATE POLICY "Only team owners can delete teams"
  ON public.project_teams
  FOR DELETE
  USING (
    owner_id = auth.uid()
    AND public.user_can_manage_projects(auth.uid())
  );

-- Recreate policies for project_team_members
DROP POLICY IF EXISTS "Members can view team membership" ON public.project_team_members;
CREATE POLICY "Members can view team membership"
  ON public.project_team_members
  FOR SELECT
  USING (
    public.user_can_view_projects(auth.uid())
    AND (
      EXISTS (
        SELECT 1
        FROM public.project_team_members self
        WHERE self.team_id = project_team_members.team_id
          AND self.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_teams t
        WHERE t.id = project_team_members.team_id
          AND t.owner_id = auth.uid()
      )
      OR public.user_is_global_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can add members to their team" ON public.project_team_members;
CREATE POLICY "Owners can add members to their team"
  ON public.project_team_members
  FOR INSERT
  WITH CHECK (
    public.user_can_manage_projects(auth.uid())
    AND public.user_has_project_service(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.project_teams t
      WHERE t.id = team_id
        AND t.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update member roles" ON public.project_team_members;
CREATE POLICY "Owners can update member roles"
  ON public.project_team_members
  FOR UPDATE
  USING (
    public.user_can_manage_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_teams t
      WHERE t.id = project_team_members.team_id
        AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.user_can_manage_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_teams t
      WHERE t.id = project_team_members.team_id
        AND t.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members or owners can remove memberships" ON public.project_team_members;
CREATE POLICY "Members or owners can remove memberships"
  ON public.project_team_members
  FOR DELETE
  USING (
    public.user_can_view_projects(auth.uid())
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.project_teams t
        WHERE t.id = project_team_members.team_id
          AND t.owner_id = auth.uid()
      )
      OR public.user_is_global_admin(auth.uid())
    )
  );

-- Recreate policies for project_sprints
DROP POLICY IF EXISTS "Team members can view sprints" ON public.project_sprints;
CREATE POLICY "Team members can view sprints"
  ON public.project_sprints
  FOR SELECT
  USING (
    public.user_can_view_projects(auth.uid())
    AND (
      public.user_is_project_team_member(project_sprints.team_id, auth.uid())
      OR public.user_is_global_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Team owners can create sprints" ON public.project_sprints;
CREATE POLICY "Team members can create sprints"
  ON public.project_sprints
  FOR INSERT
  WITH CHECK (
    public.user_can_view_projects(auth.uid())
    AND public.user_is_project_team_member(team_id, auth.uid())
  );

DROP POLICY IF EXISTS "Team owners can update sprints" ON public.project_sprints;
CREATE POLICY "Team members can update sprints"
  ON public.project_sprints
  FOR UPDATE
  USING (
    public.user_can_view_projects(auth.uid())
    AND public.user_is_project_team_member(project_sprints.team_id, auth.uid())
  )
  WITH CHECK (
    public.user_can_view_projects(auth.uid())
    AND public.user_is_project_team_member(project_sprints.team_id, auth.uid())
  );

DROP POLICY IF EXISTS "Team owners can delete sprints" ON public.project_sprints;
CREATE POLICY "Team owners can delete sprints"
  ON public.project_sprints
  FOR DELETE
  USING (
    public.user_can_manage_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_teams t
      WHERE t.id = project_sprints.team_id
        AND t.owner_id = auth.uid()
    )
  );

-- Recreate policies for project_tasks
DROP POLICY IF EXISTS "Team members can view tasks" ON public.project_tasks;
CREATE POLICY "Team members can view tasks"
  ON public.project_tasks
  FOR SELECT
  USING (
    public.user_can_view_projects(auth.uid())
    AND (
      public.user_is_global_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.project_sprints s
        WHERE s.id = project_tasks.sprint_id
          AND public.user_is_project_team_member(s.team_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Team members can create tasks" ON public.project_tasks;
CREATE POLICY "Team members can create tasks"
  ON public.project_tasks
  FOR INSERT
  WITH CHECK (
    public.user_can_view_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_sprints s
      WHERE s.id = sprint_id
        AND public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Team members can update tasks" ON public.project_tasks;
CREATE POLICY "Team members can update tasks"
  ON public.project_tasks
  FOR UPDATE
  USING (
    public.user_can_view_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND public.user_is_project_team_member(s.team_id, auth.uid())
    )
  )
  WITH CHECK (
    public.user_can_view_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Team members can delete tasks" ON public.project_tasks;
CREATE POLICY "Team members can delete tasks"
  ON public.project_tasks
  FOR DELETE
  USING (
    public.user_can_view_projects(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_sprints s
      WHERE s.id = project_tasks.sprint_id
        AND public.user_is_project_team_member(s.team_id, auth.uid())
    )
  );
