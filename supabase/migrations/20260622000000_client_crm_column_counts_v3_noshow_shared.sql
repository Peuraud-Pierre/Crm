-- ============================================================
-- get_client_column_counts v3 : colonne "No Show" partagée
--
-- La colonne "No Show" (index 8 dans COLUMN_NAMES) est désormais
-- visible par TOUS les utilisateurs côté front (cf. use_client.tsx,
-- constante NO_SHOW_COL ajoutée au filtre `.or(...)`).
--
-- Pour que le badge de comptage reste cohérent avec le board, on
-- aligne ici le filtre du compteur : un lead en colonne 8 est compté
-- quel que soit son propriétaire (customer/closer), comme le pool
-- partagé (customer IS NULL).
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
        SELECT g AS collum FROM generate_series(0, 8) AS g
    ),
    counts AS (
        SELECT COALESCE(c.collum, 0)::int AS collum, COUNT(*)::bigint AS count
        FROM public.client_crm c
        WHERE p_user_id IS NULL
           OR c.customer = p_user_id
           OR c.closers = p_user_id
           OR c.customer IS NULL
           OR c.collum = 8  -- "No Show" : colonne partagée (tous les utilisateurs)
        GROUP BY COALESCE(c.collum, 0)
    )
    SELECT a.collum, COALESCE(c.count, 0)::bigint AS count
    FROM all_cols a
    LEFT JOIN counts c ON c.collum = a.collum
    ORDER BY a.collum;
$$;

COMMENT ON FUNCTION public.get_client_column_counts(uuid) IS
    'Compteurs CRM par colonne Kanban (v3). Retourne toujours 9 lignes '
    '(indices 0..8), même à count=0. Filtre : clients liés à l''utilisateur '
    'OU pool partagé (customer IS NULL) OU colonne "No Show" (collum=8, '
    'partagée à tous). Si p_user_id est NULL, total global.';
