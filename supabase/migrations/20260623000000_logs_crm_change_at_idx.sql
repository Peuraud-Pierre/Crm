-- Index sur logs_crm.change_at pour accélérer le panneau ErrorConsole / CRM Logs.
--
-- La requête `SELECT ... FROM logs_crm ORDER BY change_at DESC LIMIT 200`
-- provoquait un `statement timeout` (57014) : sans index sur change_at, Postgres
-- doit scanner + trier TOUTE la table pour sortir les 200 dernières lignes.
-- Avec cet index, l'ORDER BY ... LIMIT devient un simple parcours d'index (top-N).
--
-- DESC NULLS LAST aligne l'index sur l'ordre demandé par PostgREST
-- (.order("change_at", { ascending: false })).
--
-- Note : sur une grosse table en production, préférer
--   CREATE INDEX CONCURRENTLY ...
-- (à exécuter hors transaction) pour éviter de verrouiller les écritures.

CREATE INDEX IF NOT EXISTS idx_logs_crm_change_at
    ON public.logs_crm (change_at DESC NULLS LAST);
