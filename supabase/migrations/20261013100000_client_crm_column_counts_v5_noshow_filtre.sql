-- ============================================================
-- get_client_column_counts v5 : « No Show » n'est plus partagée
--
-- La colonne 8 (« No Show ») était visible par tous quel que soit le
-- gestionnaire sélectionné : le filtre Gestionnaire du Kanban n'avait donc
-- aucun effet sur elle. Elle suit désormais le filtre comme les autres
-- colonnes. Seule la colonne 9 (« RDV à confirmer ») reste partagée.
-- Aligné sur SHARED_COLUMNS (shared/utils/CrmTab.ts).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_client_column_counts(
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (collum int, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    WITH all_cols AS (
        SELECT g AS collum FROM generate_series(0, 9) AS g
    ),
    counts AS (
        SELECT COALESCE(c.collum, 0)::int AS collum, COUNT(*)::bigint AS count
        FROM public.client_crm c
        WHERE p_user_id IS NULL
           OR c.customer = p_user_id
           OR c.closers = p_user_id
           OR c.customer IS NULL
           OR c.collum = 9  -- colonne partagée : « RDV à confirmer »
        GROUP BY COALESCE(c.collum, 0)
    )
    SELECT a.collum, COALESCE(c.count, 0)::bigint AS count
    FROM all_cols a
    LEFT JOIN counts c ON c.collum = a.collum
    ORDER BY a.collum;
$$;

COMMENT ON FUNCTION public.get_client_column_counts(uuid) IS
    'Compteurs CRM par colonne Kanban (v5). Retourne toujours 10 lignes '
    '(indices 0..9), même à count=0. Filtre : clients liés à l''utilisateur '
    'OU pool partagé (customer IS NULL) OU colonne partagée à tous '
    '(collum 9 « RDV à confirmer »). Si p_user_id est NULL, total global.';
