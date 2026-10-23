-- ============================================================
-- Privilèges sur les tables d'observabilité newsletter
-- ============================================================
-- Correctif de 20260817120000, qui créait les trois tables et leurs policies
-- RLS mais aucun GRANT.
--
-- RLS et privilèges sont deux couches distinctes : une policy autorise des
-- *lignes*, elle n'accorde pas le droit d'accéder à la *table*. Postgres
-- vérifie les privilèges en premier — sans GRANT, la policy n'est même jamais
-- évaluée. Symptôme observé : le service newsletter-console (connexion pgx
-- directe, hors PostgREST) recevait
--     ERROR: permission denied for table newsletter_send_runs (SQLSTATE 42501)
-- sur GET /runs, /logs et /stats, et n'arrivait pas davantage à écrire ses
-- propres logs (« log sink insert failed »).
--
-- Les tables newsletter_subscriptions / newsletter_invitation_codes, elles,
-- fonctionnent avec ce même service. Plutôt que de coder en dur un nom de rôle
-- supposé, cette migration s'aligne sur l'une d'elles, prise comme référence :
-- même propriétaire, mêmes privilèges. C'est autoréparateur quel que soit le
-- rôle réellement utilisé en production.
-- ============================================================

DO $$
DECLARE
    ref_table CONSTANT TEXT   := 'newsletter_subscriptions';
    targets   CONSTANT TEXT[] := ARRAY[
        'newsletter_send_runs',
        'newsletter_send_events',
        'newsletter_api_logs'
    ];
    ref_owner TEXT;
    tgt       TEXT;
    grant_row RECORD;
    v_grantee TEXT;
BEGIN
    SELECT tableowner INTO ref_owner
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ref_table;

    IF ref_owner IS NULL THEN
        RAISE EXCEPTION
            'Table de référence public.% introuvable — impossible d''aligner les privilèges.',
            ref_table;
    END IF;

    FOREACH tgt IN ARRAY targets LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = tgt
        ) THEN
            RAISE EXCEPTION
                'Table public.% introuvable — appliquer d''abord 20260817120000_newsletter_observability.sql.',
                tgt;
        END IF;

        -- 1. Même propriétaire que la table de référence. C'est le point
        --    décisif : le propriétaire d'une table y accède sans GRANT
        --    explicite, et contourne la RLS (hors FORCE ROW LEVEL SECURITY).
        EXECUTE format('ALTER TABLE public.%I OWNER TO %I', tgt, ref_owner);

        -- 2. Recopie du jeu de privilèges de la table de référence.
        --    aclexplode(relacl) est lu directement dans le catalogue plutôt que
        --    via information_schema.role_table_grants, qui ne montre que les
        --    droits visibles du rôle courant. grantee = 0 désigne PUBLIC.
        FOR grant_row IN
            SELECT DISTINCT
                   CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                        ELSE quote_ident(a.grantee::regrole::text)
                   END AS grantee_name,
                   a.privilege_type
            FROM pg_class c
            JOIN LATERAL aclexplode(c.relacl) a ON true
            WHERE c.relnamespace = 'public'::regnamespace
              AND c.relname = ref_table
        LOOP
            v_grantee := grant_row.grantee_name;
            EXECUTE format(
                'GRANT %s ON public.%I TO %s',
                grant_row.privilege_type, tgt, v_grantee
            );
        END LOOP;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- Filet de sécurité : rôles applicatifs standard Supabase
-- ------------------------------------------------------------
-- Si la table de référence n'avait aucune ACL explicite (accès par
-- propriétaire uniquement), la recopie ci-dessus n'a rien produit. Ces grants
-- garantissent le minimum fonctionnel. `anon` est volontairement exclu : ces
-- tables ne contiennent que de l'exploitation interne.
--
-- La lecture reste filtrée par les policies de 20260817120000
-- (has_permission('stock.arrivage.newsletter.admin')) — un GRANT SELECT ne
-- court-circuite pas la RLS.
DO $$
DECLARE
    tgt    TEXT;
    v_role TEXT;
BEGIN
    FOREACH tgt IN ARRAY ARRAY[
        'newsletter_send_runs', 'newsletter_send_events', 'newsletter_api_logs'
    ] LOOP
        FOREACH v_role IN ARRAY ARRAY['service_role', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
                IF v_role = 'service_role' THEN
                    EXECUTE format(
                        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I',
                        tgt, v_role
                    );
                ELSE
                    EXECUTE format('GRANT SELECT ON public.%I TO %I', tgt, v_role);
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;
