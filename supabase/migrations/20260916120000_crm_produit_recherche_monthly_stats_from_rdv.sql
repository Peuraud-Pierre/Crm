-- ============================================================
-- Snapshot mensuel des produits recherchés : base RDV + mois clos
-- Date: 2026-09-16
--
-- Corrige trois défauts de snapshot_produit_recherche_monthly_stats()
-- (migrations 20260903100000 / 20260904090000) :
--
-- 1. Mauvais mois : le job tourne le 1er à 02:00 UTC mais snapshottait
--    date_trunc('month', now()), soit le mois qui COMMENCE (≈ 2 h de
--    données), jamais recalculé ensuite. Le mois clos n'était jamais figé.
--    → la fonction prend désormais le mois à calculer en paramètre, par
--    défaut le mois précédent.
--
-- 2. Mauvais champ : la carte « Produits Recherchés » de la fiche
--    (colonneBrief.tsx) écrit dans brief.vendDeja ; brief.recherche est vide
--    sur les fiches actuelles → tous les totaux valaient 0.
--    → lecture de vendDeja + recherche (historique), un produit compté une
--    seule fois par client.
--
-- 3. Mauvaise population : filtre sur client_crm.updated_at, qui ne bouge
--    pas à la prise de RDV. → on prend les clients ayant eu un RDV créé
--    dans le mois, avec les mêmes règles que le front (AnalyticsContext
--    countProduitsFromRdv / use_stats isStatsEligible) : source 'crm',
--    créateurs autorisés, hors week-end (heure de Paris). Les jours fériés,
--    exclus côté front, ne le sont pas ici (écart marginal assumé).
--
-- STATS_ALLOWED_CREATORS est dupliqué depuis
-- src/features/crm/hooks/CRM_hook/use_stats.tsx — à garder aligné.
--
-- Les RDV sans produit (« Non renseigné » côté front) ne sont pas stockés.
-- ============================================================

BEGIN;

-- ── 1. Parse tolérant du brief ─────────────────────────────────────────
-- brief peut être un objet jsonb, une chaîne JSON, voire une chaîne
-- doublement encodée. Un JSON invalide renvoie NULL au lieu de faire
-- échouer tout le snapshot.

CREATE OR REPLACE FUNCTION public.crm_parse_brief(p_brief jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
    v jsonb := p_brief;
    i int := 0;
BEGIN
    WHILE v IS NOT NULL AND jsonb_typeof(v) = 'string' AND i < 3 LOOP
        BEGIN
            v := NULLIF(v #>> '{}', '')::jsonb;
        EXCEPTION WHEN others THEN
            RETURN NULL;
        END;
        i := i + 1;
    END LOOP;
    IF v IS NULL OR jsonb_typeof(v) <> 'object' THEN
        RETURN NULL;
    END IF;
    RETURN v;
END;
$$;

-- ── 2. Fonction de snapshot (remplace la version sans paramètre) ─────────
-- DROP explicite : une surcharge avec paramètre coexistant avec l'ancienne
-- rendrait l'appel sans argument du cron ambigu.

DROP FUNCTION IF EXISTS public.snapshot_produit_recherche_monthly_stats();

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
        -- Un produit une seule fois par client (DISTINCT), même s'il est
        -- présent dans vendDeja et recherche, ou si le client a eu
        -- plusieurs RDV dans le mois.
        SELECT DISTINCT
            rdv_clients.id_client,
            upper(left(trim(entry->>'nom'), 1))
                || lower(substring(trim(entry->>'nom') from 2)) AS product_name
        FROM (
            SELECT DISTINCT e.id_client
            FROM public."Event_calendar" e
            WHERE e.source = 'crm'
              AND e.id_client IS NOT NULL
              AND e.creator_id IN (
                  '2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade',
                  '8f93efc7-a3fb-496b-a397-781ae3fc41cf',
                  '921e5a2d-1447-4f4c-b893-2f935a996973',
                  'e8b399a9-61bd-4ee4-b9fe-8334019201e1'
              )
              AND (e.created_at::timestamptz AT TIME ZONE 'Europe/Paris') >= v_month
              AND (e.created_at::timestamptz AT TIME ZONE 'Europe/Paris') < (v_month + INTERVAL '1 month')
              AND EXTRACT(ISODOW FROM (e.created_at::timestamptz AT TIME ZONE 'Europe/Paris')) < 6
        ) rdv_clients
        JOIN public.client_crm c ON c.id = rdv_clients.id_client
        CROSS JOIN LATERAL (SELECT public.crm_parse_brief(c.brief) AS b) parsed
        CROSS JOIN LATERAL jsonb_array_elements(
            (CASE WHEN jsonb_typeof(parsed.b->'vendDeja') = 'array'
                  THEN parsed.b->'vendDeja' ELSE '[]'::jsonb END)
            || (CASE WHEN jsonb_typeof(parsed.b->'recherche') = 'array'
                     THEN parsed.b->'recherche' ELSE '[]'::jsonb END)
        ) AS entry
        WHERE jsonb_typeof(entry) = 'object'
          AND trim(coalesce(entry->>'nom', '')) <> ''
    ) client_products
    GROUP BY product_name;
END;
$$;

-- ── 3. Cron : inchangé (1er du mois, 02:00 UTC), il calcule désormais le
-- mois précédent via la valeur par défaut du paramètre. Rescheduling pour
-- que la commande pointe sur la nouvelle fonction.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-produit-recherche-monthly-snapshot') THEN
            PERFORM cron.unschedule('crm-produit-recherche-monthly-snapshot');
        END IF;
        PERFORM cron.schedule(
            'crm-produit-recherche-monthly-snapshot',
            '0 2 1 * *',
            $cmd$ SELECT public.snapshot_produit_recherche_monthly_stats(); $cmd$
        );
    END IF;
END $$;

-- ── 4. Recalcul de l'historique ─────────────────────────────────────────
-- Les snapshots existants (champ recherche vide, mauvais mois) sont faux :
-- on repart de zéro et on recalcule les 24 derniers mois clos. Le mois en
-- cours n'est pas stocké : le front le calcule en direct depuis les RDV.

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
