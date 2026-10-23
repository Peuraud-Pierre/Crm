-- Add priority and tracking columns to project tasks

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS priority public."Priorities" NOT NULL DEFAULT 'Normal';

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS last_moved_by uuid REFERENCES public.profiles(user_id);

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS last_moved_at timestamptz;

-- Ensure existing rows have consistent values
UPDATE public.project_tasks
SET priority = COALESCE(priority, 'Normal');

-- Index to accelerate lookups by last mover
CREATE INDEX IF NOT EXISTS project_tasks_last_moved_by_idx
  ON public.project_tasks(last_moved_by);
