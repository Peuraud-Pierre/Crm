-- ============================================================
-- get_client_column_counts v2 : garantit toujours 9 lignes
--
-- v1 (GROUP BY collum) omettait les colonnes vides. Conséquence
-- côté front : `setClientCountsByColumn(data)` retournait un map
-- partiel et le badge tombait sur le fallback mémoire (souvent 0)
-- alors qu'on voulait afficher explicitement 0 pour cette colonne.
--
-- v2 utilise generate_series(0, 8) + LEFT JOIN pour retourner
-- systématiquement 9 lignes (une par index COLUMN_NAMES), même
-- si count = 0. Plus de bucket manquant.
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
        GROUP BY COALESCE(c.collum, 0)
    )
    SELECT a.collum, COALESCE(c.count, 0)::bigint AS count
    FROM all_cols a
    LEFT JOIN counts c ON c.collum = a.collum
    ORDER BY a.collum;
$$;

COMMENT ON FUNCTION public.get_client_column_counts(uuid) IS
    'Compteurs CRM par colonne Kanban (v2). Retourne toujours 9 lignes '
    '(indices 0..8), même à count=0. Filtre : clients liés à l''utilisateur '
    'OU pool partagé (customer IS NULL). Si p_user_id est NULL, total global.';
