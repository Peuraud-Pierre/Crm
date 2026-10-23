-- ============================================================
-- count_clients_filtered : total clients filtré (commercial + période)
--
-- Le KPI "Clients totaux" de l'onglet Analytics doit s'afficher
-- instantanément (sans attendre la pagination de fetchAllClients)
-- ET respecter les filtres du Header : collaborateur + période.
--
-- get_client_column_counts ne filtre que par utilisateur ; on ajoute
-- ici une borne de dates [p_start, p_end) sur created_at pour coller
-- au sélecteur de période (semaine / mois / trimestre / année).
-- Les bornes sont calculées côté front et passées en timestamptz.
-- Si p_start / p_end sont NULL → pas de filtre date (vue globale).
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_clients_filtered(
    p_user_id uuid DEFAULT NULL,
    p_start timestamptz DEFAULT NULL,
    p_end timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT COUNT(*)::bigint
    FROM public.client_crm c
    WHERE (
        -- Filtre collaborateur : mêmes règles que get_client_column_counts
        -- (clients liés à l'utilisateur OU pool partagé customer IS NULL).
        p_user_id IS NULL
        OR c.customer = p_user_id
        OR c.closers = p_user_id
        OR c.customer IS NULL
    )
    AND (p_start IS NULL OR c.created_at >= p_start)
    AND (p_end IS NULL OR c.created_at < p_end);
$$;

COMMENT ON FUNCTION public.count_clients_filtered(uuid, timestamptz, timestamptz) IS
    'Total clients filtré par collaborateur (p_user_id) et période '
    '[p_start, p_end) sur created_at. NULL = pas de filtre sur la dimension '
    'correspondante. Utilisé par le KPI "Clients totaux" de l''onglet Analytics.';
