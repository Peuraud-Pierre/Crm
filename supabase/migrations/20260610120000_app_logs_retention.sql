-- ============================================================
-- Rétention RGPD des tables de logs — multi-tables, config-driven
-- ============================================================
-- Les logs de plus de N mois (12 par défaut) sont supprimés
-- automatiquement chaque jour, et chaque suppression est tracée
-- dans un journal séparé (app_logs_retention_audit), une ligne par
-- table purgée, afin que les administrateurs en soient informés.
--
-- Tables couvertes : définies dans app_logs_retention_config
--   (table + colonne de date + durée). Ajouter une table = un INSERT.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Configuration des tables soumises à rétention
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_logs_retention_config (
    table_name       TEXT PRIMARY KEY,
    date_column      TEXT    NOT NULL,
    retention_months INTEGER NOT NULL DEFAULT 12 CHECK (retention_months >= 0),
    enabled          BOOLEAN NOT NULL DEFAULT true,
    -- Condition SQL optionnelle appliquée en plus de l'âge (ex. ne purger que
    -- les tickets de bug). Injectée dans le DELETE → réservée aux admins (RLS).
    extra_filter     TEXT
);
-- Au cas où la table existe déjà sans la colonne (migration ré-exécutée).
ALTER TABLE public.app_logs_retention_config
    ADD COLUMN IF NOT EXISTS extra_filter TEXT;

COMMENT ON TABLE public.app_logs_retention_config IS
    'Tables soumises à la purge de rétention (table, colonne de date, durée, filtre optionnel).';

INSERT INTO public.app_logs_retention_config (table_name, date_column, retention_months, extra_filter) VALUES
    ('app_logs',     'created_at', 12, NULL),
    ('logs_crm',     'change_at',  12, NULL),
    ('ticket_table', 'created_at', 12, 'category = ''bug''')
ON CONFLICT (table_name) DO NOTHING;

ALTER TABLE public.app_logs_retention_config ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Journal d'audit des purges (séparé, immuable)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_logs_retention_audit (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    executed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Table concernée par cette ligne d'audit.
    table_name        TEXT        NOT NULL DEFAULT 'app_logs',
    -- Seuil utilisé pour la coupe (now() - durée au moment de l'exécution).
    cutoff_at         TIMESTAMPTZ NOT NULL,
    deleted_count     INTEGER     NOT NULL,
    oldest_deleted_at TIMESTAMPTZ,
    newest_deleted_at TIMESTAMPTZ,
    -- 'automatic' = job planifié ; 'manual' = déclenché depuis la console.
    mode              TEXT        NOT NULL DEFAULT 'automatic'
                                  CHECK (mode IN ('automatic', 'manual')),
    triggered_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_app_logs_retention_audit_executed_at
    ON public.app_logs_retention_audit (executed_at DESC);

COMMENT ON TABLE public.app_logs_retention_audit IS
    'Journal des suppressions de logs (une ligne par table purgée) — rétention RGPD.';

ALTER TABLE public.app_logs_retention_audit ENABLE ROW LEVEL SECURITY;

-- Lecture admin (sert au temps réel ; le panneau lit via la fonction definer).
-- Aucune policy d'écriture : seule la fonction SECURITY DEFINER insère.
DROP POLICY IF EXISTS "Super Admin can read retention audit"
    ON public.app_logs_retention_audit;
CREATE POLICY "Super Admin can read retention audit"
    ON public.app_logs_retention_audit FOR SELECT
    TO authenticated
    USING (
        public.user_is_global_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE (id = auth.uid() OR user_id = auth.uid())
              AND role = 'Super Admin'
        )
    );

-- ------------------------------------------------------------
-- 3. Fonction de purge multi-tables + audit
-- ------------------------------------------------------------
-- Parcourt la config et purge chaque table activée.
-- p_mode   : 'automatic' (cron) ou 'manual' (console).
-- p_months : override d'ancienneté pour TOUTES les tables (test/console).
--            NULL = chaque table utilise sa propre durée (config).
-- p_tables : tables ciblées (sous-ensemble) ; NULL = toutes les tables activées.
-- Retourne une ligne d'audit par table réellement purgée.
DROP FUNCTION IF EXISTS public.purge_old_app_logs(TEXT);
DROP FUNCTION IF EXISTS public.purge_old_app_logs(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.purge_old_app_logs(TEXT, INTEGER, TEXT[]);
CREATE FUNCTION public.purge_old_app_logs(
    p_mode   TEXT    DEFAULT 'automatic',
    p_months INTEGER DEFAULT NULL,
    p_tables TEXT[]  DEFAULT NULL
)
RETURNS SETOF public.app_logs_retention_audit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    cfg      RECORD;
    v_months INTEGER;
    v_cutoff TIMESTAMPTZ;
    v_count  INTEGER;
    v_oldest TIMESTAMPTZ;
    v_newest TIMESTAMPTZ;
    v_mode   TEXT := CASE WHEN p_mode = 'manual' THEN 'manual' ELSE 'automatic' END;
    v_audit  public.app_logs_retention_audit;
BEGIN
    -- Garde-fou : en contexte requête (auth.uid() non NULL), réservé aux admins.
    -- Le cron tourne sans JWT (auth.uid() = NULL) et passe donc le garde-fou.
    IF auth.uid() IS NOT NULL
        AND NOT public.user_is_global_admin()
        AND NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE (id = auth.uid() OR user_id = auth.uid())
              AND role = 'Super Admin'
        )
    THEN
        RAISE EXCEPTION 'insufficient_privilege: purge réservée aux administrateurs';
    END IF;

    FOR cfg IN
        SELECT table_name, date_column, retention_months, extra_filter
        FROM public.app_logs_retention_config
        WHERE enabled
          AND (p_tables IS NULL OR table_name = ANY(p_tables))
    LOOP
        v_months := GREATEST(COALESCE(p_months, cfg.retention_months), 0);
        v_cutoff := now() - make_interval(months => v_months);

        -- DELETE dynamique : identifiants échappés par %I ; filtre optionnel
        -- (extra_filter) ajouté tel quel (config admin uniquement).
        EXECUTE format(
            'WITH d AS (DELETE FROM public.%I WHERE %I < $1 %s RETURNING %I AS ts)
             SELECT count(*), min(ts), max(ts) FROM d',
            cfg.table_name,
            cfg.date_column,
            CASE
                WHEN cfg.extra_filter IS NOT NULL
                     AND length(btrim(cfg.extra_filter)) > 0
                THEN 'AND (' || cfg.extra_filter || ')'
                ELSE ''
            END,
            cfg.date_column
        )
        INTO v_count, v_oldest, v_newest
        USING v_cutoff;

        IF v_count > 0 THEN
            INSERT INTO public.app_logs_retention_audit
                (table_name, cutoff_at, deleted_count, oldest_deleted_at,
                 newest_deleted_at, mode, triggered_by)
            VALUES
                (cfg.table_name, v_cutoff, v_count, v_oldest, v_newest,
                 v_mode, auth.uid())
            RETURNING * INTO v_audit;
            RETURN NEXT v_audit;
        END IF;
    END LOOP;

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_old_app_logs(TEXT, INTEGER, TEXT[]) TO authenticated;

-- ------------------------------------------------------------
-- 4. Lecture du journal via fonction SECURITY DEFINER
-- ------------------------------------------------------------
-- Contourne la RLS (fragile sur le mapping id/user_id) pour garantir
-- l'affichage. Accès déjà restreint en amont par la permission
-- applicative `manager.console`.
CREATE OR REPLACE FUNCTION public.get_app_logs_retention_audit(p_limit INTEGER DEFAULT 200)
RETURNS SETOF public.app_logs_retention_audit
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT *
    FROM public.app_logs_retention_audit
    ORDER BY executed_at DESC
    LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_app_logs_retention_audit(INTEGER) TO authenticated;

-- Realtime : notifie l'INSERT d'une purge (ignore si déjà présent).
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_logs_retention_audit;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication non modifiée (%).', SQLERRM;
END $$;

-- ------------------------------------------------------------
-- 5. Planification quotidienne via pg_cron (03:00 UTC)
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_cron;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron non installable ici (%).', SQLERRM;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-app-logs') THEN
            PERFORM cron.unschedule('purge-old-app-logs');
        END IF;
        PERFORM cron.schedule(
            'purge-old-app-logs',
            '0 3 * * *',
            $cmd$ SELECT public.purge_old_app_logs('automatic'); $cmd$
        );
    END IF;
END $$;
