-- Project management schema: teams, sprints, tasks

-- Enums for sprint and task status
CREATE TYPE public.project_sprint_status AS ENUM ('planned', 'active', 'completed', 'archived');
CREATE TYPE public.project_task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Teams table
CREATE TABLE public.project_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team members table
CREATE TABLE public.project_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.project_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Sprints table
CREATE TABLE public.project_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.project_teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  status public.project_sprint_status NOT NULL DEFAULT 'planned',
  start_date timestamptz,
  end_date timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES public.project_sprints(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.project_task_status NOT NULL DEFAULT 'todo',
  assignee_id uuid REFERENCES public.profiles(user_id),
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  position integer NOT NULL DEFAULT 0,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX project_team_members_team_id_idx ON public.project_team_members(team_id);
CREATE INDEX project_team_members_user_id_idx ON public.project_team_members(user_id);
CREATE INDEX project_sprints_team_id_idx ON public.project_sprints(team_id);
CREATE INDEX project_sprints_status_idx ON public.project_sprints(status);
CREATE INDEX project_tasks_sprint_id_idx ON public.project_tasks(sprint_id);
CREATE INDEX project_tasks_status_idx ON public.project_tasks(status);
CREATE INDEX project_tasks_assignee_id_idx ON public.project_tasks(assignee_id);

-- Enable row level security
ALTER TABLE public.project_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Policies for project_teams
CREATE POLICY "Project team members can view teams"
  ON public.project_teams
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_team_members m
      WHERE m.team_id = project_teams.id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create teams they own"
  ON public.project_teams
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Only team owners can update teams"
  ON public.project_teams
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Only team owners can delete teams"
  ON public.project_teams
  FOR DELETE
  USING (owner_id = auth.uid());

-- Policies for project_team_members
CREATE POLICY "Members can view team membership"
  ON public.project_team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_team_members self
      WHERE self.team_id = project_team_members.team_id
        AND self.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_team_members.team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can add members to their team"
  ON public.project_team_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update member roles"
  ON public.project_team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_team_members.team_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_team_members.team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Members or owners can remove memberships"
  ON public.project_team_members
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_team_members.team_id AND t.owner_id = auth.uid()
    )
  );

-- Policies for project_sprints
CREATE POLICY "Team members can view sprints"
  ON public.project_sprints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      LEFT JOIN public.project_team_members m ON m.team_id = t.id
      WHERE t.id = project_sprints.team_id
        AND (t.owner_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "Team owners can create sprints"
  ON public.project_sprints
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can update sprints"
  ON public.project_sprints
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_sprints.team_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_sprints.team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can delete sprints"
  ON public.project_sprints
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_teams t
      WHERE t.id = project_sprints.team_id AND t.owner_id = auth.uid()
    )
  );

-- Policies for project_tasks
CREATE POLICY "Team members can view tasks"
  ON public.project_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      JOIN public.project_teams t ON t.id = s.team_id
      LEFT JOIN public.project_team_members m ON m.team_id = t.id
      WHERE s.id = project_tasks.sprint_id
        AND (t.owner_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "Team members can create tasks"
  ON public.project_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      JOIN public.project_teams t ON t.id = s.team_id
      LEFT JOIN public.project_team_members m ON m.team_id = t.id
      WHERE s.id = sprint_id
        AND (t.owner_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "Team members can update tasks"
  ON public.project_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      JOIN public.project_teams t ON t.id = s.team_id
      LEFT JOIN public.project_team_members m ON m.team_id = t.id
      WHERE s.id = project_tasks.sprint_id
        AND (t.owner_id = auth.uid() OR m.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      JOIN public.project_teams t ON t.id = s.team_id
      LEFT JOIN public.project_team_members m ON m.team_id = t.id
      WHERE s.id = project_tasks.sprint_id
        AND (t.owner_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "Team members can delete tasks"
  ON public.project_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_sprints s
      JOIN public.project_teams t ON t.id = s.team_id
      LEFT JOIN public.project_team_members m ON m.team_id = t.id
      WHERE s.id = project_tasks.sprint_id
        AND (t.owner_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

-- Triggers to maintain updated_at
CREATE TRIGGER update_project_teams_updated_at
  BEFORE UPDATE ON public.project_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_sprints_updated_at
  BEFORE UPDATE ON public.project_sprints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime replication
ALTER TABLE public.project_teams REPLICA IDENTITY FULL;
ALTER TABLE public.project_team_members REPLICA IDENTITY FULL;
ALTER TABLE public.project_sprints REPLICA IDENTITY FULL;
ALTER TABLE public.project_tasks REPLICA IDENTITY FULL;

-- Extend role and service permissions with projects flag
UPDATE public.roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{projects}',
  CASE
    WHEN nom IN ('SuperAdmin', 'Admin') THEN 'true'::jsonb
    ELSE COALESCE(permissions->'projects', 'false'::jsonb)
  END,
  true
);

UPDATE public.services
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{projects}',
  COALESCE(permissions->'projects', 'true'::jsonb),
  true
);
