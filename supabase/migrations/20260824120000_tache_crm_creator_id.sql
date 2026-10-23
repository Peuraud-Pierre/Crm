-- Ajoute creator_id sur Tache_crm, en miroir du pattern owner (colonne +
-- FK vers profiles(user_id)) : owner = à qui la tâche est assignée,
-- creator_id = qui l'a créée. Sert à colorer une tâche en violet côté front
-- (src/features/crm/components/Task/TaskItem.tsx) selon le rôle du
-- créateur (admin/superadmin), et non plus selon le rôle de l'owner comme
-- c'était fait par erreur jusqu'ici.
--
-- Pas de valeur par défaut côté DB : écrit explicitement par le front à la
-- création (voir use_tache.tsx, create_Tache), comme owner. Les tâches déjà
-- existantes restent avec creator_id = NULL (aucune tentative de
-- rétro-déduction de créateur historique).

ALTER TABLE public."Tache_crm"
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profiles(user_id);

CREATE INDEX IF NOT EXISTS tache_crm_creator_id_idx
  ON public."Tache_crm"(creator_id);
