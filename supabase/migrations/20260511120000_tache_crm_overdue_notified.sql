-- ============================================================
-- CRM : tracking notifications "tâche en retard"
--
-- Ajoute une colonne `overdue_notified_at` sur Tache_crm afin
-- que le watcher backend (cypher_go main-server) ne notifie
-- qu'une seule fois chaque tâche dépassée.
--
-- Le watcher scanne périodiquement Tache_crm et insère une row
-- dans `notification` (déclenchant le webhook WebPush). Cette
-- colonne marque les tâches déjà traitées pour éviter le spam.
-- ============================================================

ALTER TABLE public."Tache_crm"
    ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_tache_crm_overdue_scan
    ON public."Tache_crm" (date)
    WHERE overdue_notified_at IS NULL
      AND COALESCE(valide, false) = false
      AND owner IS NOT NULL;
