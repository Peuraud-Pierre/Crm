-- Fonction RPC pour les stats d'événements CRM.
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire (bypass RLS),
-- ce qui garantit que les résultats sont identiques à la requête SQL directe.
CREATE OR REPLACE FUNCTION get_crm_event_stats(
    p_range_start timestamptz,
    p_range_end   timestamptz
)
RETURNS SETOF "Event_calendar"
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT DISTINCT ON (id_client, debut::date) *
    FROM public."Event_calendar"
    WHERE
        created_at >= p_range_start
        AND created_at  < p_range_end
    ORDER BY
        id_client,
        debut::date,
        created_at ASC;
$$;

-- Droit d'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_crm_event_stats(timestamptz, timestamptz) TO authenticated;
