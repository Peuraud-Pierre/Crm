-- ============================================================
-- Projets — pièces jointes des tâches
-- Date: 2026-09-29
--
-- Stockage dans un bucket Supabase privé plutôt que dans le Drive
-- (cypher_go) : les liens du Drive sont des jetons de 2 minutes liés à
-- un utilisateur, et l'accès y passe par un partage fichier par
-- fichier. Ici l'accès suit l'équipe du projet : un membre ajouté
-- plus tard voit les pièces jointes sans resynchronisation.
--
-- Objets rangés sous `<task_id>/<uuid>-<nom>` : le premier segment du
-- chemin porte la tâche, c'est ce que testent les policies du bucket.
--
-- Droits alignés sur ceux de project_tasks
-- (20260824130000_project_rls_realign.sql) :
--   - lecture : quiconque peut voir la tâche ;
--   - ajout / suppression : membre de l'équipe.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_task_attachments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    storage_path text NOT NULL UNIQUE,
    file_name    text NOT NULL,
    mime_type    text,
    size_bytes   bigint NOT NULL DEFAULT 0,
    uploaded_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_task_attachments_task_id_idx
    ON public.project_task_attachments (task_id);

ALTER TABLE public.project_task_attachments ENABLE ROW LEVEL SECURITY;

-- Feuille : lit project_tasks + project_sprints. SECURITY DEFINER pour
-- ne pas repasser par leurs policies depuis storage.objects (même
-- raison que les feuilles de 20260824120000).
CREATE OR REPLACE FUNCTION public.user_can_access_task(
    target_task uuid,
    member_only boolean DEFAULT false,
    target_user uuid DEFAULT auth.uid()
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_tasks t
    JOIN public.project_sprints s ON s.id = t.sprint_id
    WHERE t.id = target_task
      AND public.user_can_access_project(s.team_id, target_user)
      AND (NOT member_only OR public.user_is_project_team_member(s.team_id, target_user))
  );
$function$;

DROP POLICY IF EXISTS "Task viewers can view attachments" ON public.project_task_attachments;
CREATE POLICY "Task viewers can view attachments"
    ON public.project_task_attachments FOR SELECT
    TO authenticated
    USING (user_can_access_task(task_id));

DROP POLICY IF EXISTS "Team members can add attachments" ON public.project_task_attachments;
CREATE POLICY "Team members can add attachments"
    ON public.project_task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = (select auth.uid())
        AND storage_path LIKE task_id::text || '/%'
        AND user_can_access_task(task_id, true)
    );

DROP POLICY IF EXISTS "Team members can delete attachments" ON public.project_task_attachments;
CREATE POLICY "Team members can delete attachments"
    ON public.project_task_attachments FOR DELETE
    TO authenticated
    USING (user_can_access_task(task_id, true));

-- ------------------------------------------------------------
-- Bucket privé : lecture par URL signée uniquement.
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
SELECT 'project-task-attachments', 'project-task-attachments', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-task-attachments');

DROP POLICY IF EXISTS "Task viewers can read task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete task attachments" ON storage.objects;

-- Comparaison en texte et non cast en uuid : un chemin forgé qui ne
-- commence pas par un uuid est refusé au lieu de faire échouer la requête.
CREATE POLICY "Task viewers can read task attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'project-task-attachments'
        AND EXISTS (
            SELECT 1 FROM public.project_tasks t
            WHERE t.id::text = (storage.foldername(name))[1]
              AND public.user_can_access_task(t.id)
        )
    );

CREATE POLICY "Team members can upload task attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'project-task-attachments'
        AND EXISTS (
            SELECT 1 FROM public.project_tasks t
            WHERE t.id::text = (storage.foldername(name))[1]
              AND public.user_can_access_task(t.id, true)
        )
    );

CREATE POLICY "Team members can delete task attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'project-task-attachments'
        AND EXISTS (
            SELECT 1 FROM public.project_tasks t
            WHERE t.id::text = (storage.foldername(name))[1]
              AND public.user_can_access_task(t.id, true)
        )
    );

-- Après application : régénérer src/integrations/supabase/types.ts
-- (nouvelle table project_task_attachments).
