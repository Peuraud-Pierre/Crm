-- Add project status handling

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_team_status') THEN
    CREATE TYPE public.project_team_status AS ENUM ('active', 'archived');
  END IF;
END $$;

ALTER TABLE public.project_teams
  ADD COLUMN IF NOT EXISTS status public.project_team_status NOT NULL DEFAULT 'active';

UPDATE public.project_teams
SET status = 'active'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS project_teams_status_idx ON public.project_teams(status);
