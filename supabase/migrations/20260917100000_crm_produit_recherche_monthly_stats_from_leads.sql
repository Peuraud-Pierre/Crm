-- ============================================================
-- Snapshot mensuel des produits recherchés : base leads entrants
-- Date: 2026-09-17
--
-- 20260916120000 calculait le snapshot sur les clients ayant eu un RDV
-- dans le mois. Le classement Analytics compte désormais les leads
-- entrants (clients créés sur la période), pour être comparable au KPI
-- « Leads » (count_clients_filtered) — cf. AnalyticsContext
-- produitsRechercheRankingData / useLeadBriefs.
--
-- Bornes de mois comme le KPI : created_at comparé à une date sans fuseau,
-- donc interprétée dans le fuseau de la session (celui du RPC).
--
-- Produits (vendDeja + recherche) ET styles (besoinsFemme + besoinsHomme),
-- comme extractProduitsRecherches côté front ; chacun une seule fois par
-- client. Leads sans produit ni style non stockés (hors classement côté
-- front). Mois précédent par défaut pour le cron.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.snapshot_produit_recherche_monthly_stats(
    p_month date DEFAULT (date_trunc('month', (now() AT TIME ZONE 'Europe/Paris')) - INTERVAL '1 month')::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
    v_month date := date_trunc('month', p_month)::date;
BEGIN
    DELETE FROM public.crm_produit_recherche_monthly_stats
    WHERE snapshot_month = v_month;

    INSERT INTO public.crm_produit_recherche_monthly_stats (snapshot_month, product_name, total_entries)
    SELECT v_month, product_name, COUNT(*)
    FROM (
        SELECT DISTINCT
            c.id,
            upper(left(trim(item.nom), 1))
                || lower(substring(trim(item.nom) from 2)) AS product_name
        FROM public.client_crm c
        CROSS JOIN LATERAL (SELECT public.crm_parse_brief(c.brief) AS b) parsed
        CROSS JOIN LATERAL (
            -- Produits : objets { nom, ... }
            SELECT e->>'nom' AS nom
            FROM jsonb_array_elements(
                (CASE WHEN jsonb_typeof(parsed.b->'vendDeja') = 'array'
                      THEN parsed.b->'vendDeja' ELSE '[]'::jsonb END)
                || (CASE WHEN jsonb_typeof(parsed.b->'recherche') = 'array'
                         THEN parsed.b->'recherche' ELSE '[]'::jsonb END)
            ) e
            WHERE jsonb_typeof(e) = 'object'
            UNION ALL
            -- Styles : chaînes
            SELECT e #>> '{}' AS nom
            FROM jsonb_array_elements(
                (CASE WHEN jsonb_typeof(parsed.b->'besoinsFemme') = 'array'
                      THEN parsed.b->'besoinsFemme' ELSE '[]'::jsonb END)
                || (CASE WHEN jsonb_typeof(parsed.b->'besoinsHomme') = 'array'
                         THEN parsed.b->'besoinsHomme' ELSE '[]'::jsonb END)
            ) e
            WHERE jsonb_typeof(e) = 'string'
        ) item
        WHERE c.created_at >= v_month::timestamp::timestamptz
          AND c.created_at < (v_month + INTERVAL '1 month')::timestamp::timestamptz
          AND trim(coalesce(item.nom, '')) <> ''
    ) client_products
    GROUP BY product_name;
END;
$$;

-- Recalcul de l'historique sur la nouvelle base (24 derniers mois clos).
-- Le mois en cours n'est pas stocké : le front le calcule en direct.

DELETE FROM public.crm_produit_recherche_monthly_stats;

DO $$
DECLARE
    v_current date := date_trunc('month', (now() AT TIME ZONE 'Europe/Paris'))::date;
    m int;
BEGIN
    FOR m IN 1..24 LOOP
        PERFORM public.snapshot_produit_recherche_monthly_stats(
            (v_current - make_interval(months => m))::date
        );
    END LOOP;
END $$;

COMMIT;
