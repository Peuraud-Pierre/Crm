-- ============================================================
-- Compteurs par colonne pour le board Kanban CRM
--
-- Avec la pagination côté DB (fetch_client paginé), le compteur
-- "Nouveau lead / En qualification / …" du board ne reflétait
-- que le sous-ensemble chargé en mémoire. Cette migration ajoute :
--   - des index pour rendre l'agrégat GROUP BY collum trivial,
--   - une RPC `get_client_column_counts(p_user_id)` qui renvoie le
--     total par colonne, filtré selon la même règle que fetch_client
--     (clients dont customer = p_user_id, closers = p_user_id, ou
--     customer IS NULL — pool partagé). Si p_user_id est NULL, on
--     renvoie le total global (vue admin).
-- ============================================================

-- Index sur la colonne Kanban (filtre principal du GROUP BY)
CREATE INDEX IF NOT EXISTS client_crm_collum_idx
    ON public.client_crm(collum);

-- Index composites pour le filtre par utilisateur (setter / closer)
CREATE INDEX IF NOT EXISTS client_crm_customer_collum_idx
    ON public.client_crm(customer, collum);

CREATE INDEX IF NOT EXISTS client_crm_closers_collum_idx
    ON public.client_crm(closers, collum);

-- ------------------------------------------------------------
-- RPC : nombre de clients par colonne, filtré par utilisateur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_column_counts(
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (collum int, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        COALESCE(c.collum, 0)::int AS collum,
        COUNT(*)::bigint           AS count
    FROM public.client_crm c
    WHERE p_user_id IS NULL
       OR c.customer = p_user_id
       OR c.closers = p_user_id
       OR c.customer IS NULL
    GROUP BY COALESCE(c.collum, 0);
$$;

COMMENT ON FUNCTION public.get_client_column_counts(uuid) IS
    'Compteurs CRM par colonne Kanban. Filtre identique à fetch_client : '
    'clients liés à l''utilisateur OU pool partagé (customer IS NULL). '
    'Si p_user_id est NULL, retourne le total global.';

-- Ouverture aux utilisateurs authentifiés (RLS s'applique en SECURITY INVOKER).
GRANT EXECUTE ON FUNCTION public.get_client_column_counts(uuid) TO authenticated;
