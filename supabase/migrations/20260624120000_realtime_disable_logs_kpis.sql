-- Retrait des tables à fort volume d'écriture (logs, audit, historique) et des
-- KPIs de la publication Realtime `supabase_realtime`.
--
-- Pourquoi : chaque table inscrite dans la publication fait décoder son WAL en
-- continu par le serveur Realtime pour TOUS les clients connectés (le filtre
-- côté client n'intervient qu'après décodage). Ces tables n'ont aucune valeur
-- collaborative temps réel — les écrans concernés se rechargent au montage et
-- via un refetch manuel (voir hooks useAppLogs / useLogsCRM / useLogRetention /
-- useHistory / useKPIs). Les retirer divise d'autant le travail de décodage WAL.
--
-- Idempotent : DROP conditionnel (ne casse pas si la table n'est pas publiée).

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'app_logs',                  -- logs applicatifs (append-heavy)
        'logs_crm',                  -- audit CRM (append-heavy)
        'app_logs_retention_audit',  -- journal de purge (consultatif, cron)
        'activity_log',              -- journal d'activité stock (append-heavy)
        'category_price_history',    -- historique de prix (append-only)
        'kpis'                       -- KPIs dashboard (évolution lente)
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t
            );
            RAISE NOTICE 'Realtime désactivé pour public.%', t;
        END IF;
    END LOOP;
END;
$$;
