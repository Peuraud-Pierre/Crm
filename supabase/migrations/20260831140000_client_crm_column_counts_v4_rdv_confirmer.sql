-- ============================================================
-- get_client_column_counts v4 : colonne « RDV à confirmer »
--
-- Deux corrections sur la v3 :
--
-- 1. La série s'arrêtait à 8, alors que COLUMN_NAMES compte dix colonnes
--    depuis l'ajout de « RDV à confirmer » (index 9). Le badge de cette
--    colonne n'avait donc aucune ligne à afficher, quel que soit le nombre
--    de leads qui s'y trouvaient.
--
-- 2. La colonne 9 rejoint les colonnes partagées : un RDV pris sur Amelia
--    doit pouvoir être confirmé par n'importe quel commercial, y compris
--    quand le provider n'a pas été résolu et que le lead n'est rattaché à
--    personne. Aligné sur SHARED_COLUMNS (shared/utils/CrmTab.ts).
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
           OR c.collum IN (8, 9)  -- colonnes partagées : « No Show », « RDV à confirmer »
        GROUP BY COALESCE(c.collum, 0)
    )
    SELECT a.collum, COALESCE(c.count, 0)::bigint AS count
    FROM all_cols a
    LEFT JOIN counts c ON c.collum = a.collum
    ORDER BY a.collum;
$$;

COMMENT ON FUNCTION public.get_client_column_counts(uuid) IS
    'Compteurs CRM par colonne Kanban (v4). Retourne toujours 10 lignes '
    '(indices 0..9), même à count=0. Filtre : clients liés à l''utilisateur '
    'OU pool partagé (customer IS NULL) OU colonnes partagées à tous '
    '(collum 8 « No Show » et 9 « RDV à confirmer »). Si p_user_id est NULL, '
    'total global.';
