-- ============================================================
-- Observabilité de la newsletter arrivages
-- ============================================================
-- Le service Go `newsletter-console` ne persistait rien : slog écrivait sur
-- stdout et les compteurs d'un envoi (`pipeline: done` → sent/failed/durée)
-- étaient jetés. Impossible donc d'afficher le moindre KPI, historique ou
-- message d'erreur dans /arrivage-admin.
--
-- Trois tables, écrites exclusivement par le service Go (connexion pgx directe
-- en service_role, hors PostgREST et hors RLS) et lues par le front :
--   newsletter_send_runs   → une ligne par exécution du pipeline
--   newsletter_send_events → une ligne par tentative de livraison à un abonné
--   newsletter_api_logs    → les lignes slog du service (requêtes HTTP + métier)
--
-- Lecture gardée par la même permission que le reste de la feature
-- (`stock.arrivage.newsletter.admin`, cf. 20260605_newsletter_invitation_codes).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Runs — une ligne par exécution du pipeline
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_send_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Origine du déclenchement : webhook Supabase (debounce), bouton
    -- « Envoyer à tous » de la console, ou renvoi ciblé à un abonné.
    trigger           TEXT        NOT NULL
                                  CHECK (trigger IN ('webhook', 'manual', 'resend')),
    -- Sujet du JWT à l'origine du déclenchement — NULL pour un webhook.
    triggered_by      UUID,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at       TIMESTAMPTZ,
    -- 'running' tant que le run est en vol ; 'partial' = au moins un envoi
    -- réussi et au moins un échoué ; 'aborted' = timeout/annulation du contexte.
    status            TEXT        NOT NULL DEFAULT 'running'
                                  CHECK (status IN ('running', 'success', 'partial', 'failed', 'aborted')),
    -- Nombre de lignes du tableau arrivage embarquées dans l'Excel.
    rows_count        INTEGER     NOT NULL DEFAULT 0,
    subscribers_total INTEGER     NOT NULL DEFAULT 0,
    sent_count        INTEGER     NOT NULL DEFAULT 0,
    failed_count      INTEGER     NOT NULL DEFAULT 0,
    duration_ms       INTEGER,
    -- Erreur globale (fetch impossible, panic récupérée) — les erreurs par
    -- destinataire vivent dans newsletter_send_events.
    error             TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_send_runs_started_at
    ON public.newsletter_send_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_runs_status
    ON public.newsletter_send_runs (status, started_at DESC);

COMMENT ON TABLE public.newsletter_send_runs IS
    'Historique des exécutions du pipeline newsletter arrivages (écrit par newsletter-console).';

-- ------------------------------------------------------------
-- 2. Events — une ligne par tentative de livraison
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_send_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id           UUID        NOT NULL
                                 REFERENCES public.newsletter_send_runs(id) ON DELETE CASCADE,
    -- Pas de FK vers auth.users : un abonné supprimé ne doit pas effacer
    -- l'historique de ce qui lui a été envoyé.
    user_id          UUID        NOT NULL,
    email            TEXT        NOT NULL,
    status           TEXT        NOT NULL CHECK (status IN ('sent', 'failed')),
    error            TEXT,
    xlsx_size_bytes  INTEGER,
    -- Durées séparées : distinguer un Excel lent d'un SMTP lent.
    excel_ms         INTEGER,
    smtp_ms          INTEGER,
    -- Nombre de cellules mises en évidence comme modifiées pour cet abonné.
    changed_cells    INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_send_events_run_id
    ON public.newsletter_send_events (run_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_events_status
    ON public.newsletter_send_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_events_created_at
    ON public.newsletter_send_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_events_user_id
    ON public.newsletter_send_events (user_id, created_at DESC);

COMMENT ON TABLE public.newsletter_send_events IS
    'Détail par destinataire d''un run newsletter : statut, erreur SMTP, durées.';

-- ------------------------------------------------------------
-- 3. Logs applicatifs du service Go
-- ------------------------------------------------------------
-- BIGINT identity plutôt qu'UUID : la pagination du front se fait par curseur
-- décroissant sur cet id, et le volume est bien plus élevé que les deux tables
-- ci-dessus.
CREATE TABLE IF NOT EXISTS public.newsletter_api_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    level       TEXT        NOT NULL,
    msg         TEXT        NOT NULL,
    -- Corrélation d'une requête HTTP : les lignes `→ request` et `← response`
    -- d'un même appel partagent le même req_id (cf. logMiddleware).
    req_id      TEXT,
    method      TEXT,
    path        TEXT,
    status      INTEGER,
    duration_ms INTEGER,
    -- Tous les autres attributs slog de la ligne, non promus en colonne.
    attrs       JSONB
);

CREATE INDEX IF NOT EXISTS idx_newsletter_api_logs_ts
    ON public.newsletter_api_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_api_logs_level_ts
    ON public.newsletter_api_logs (level, ts DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_api_logs_req_id
    ON public.newsletter_api_logs (req_id);

COMMENT ON TABLE public.newsletter_api_logs IS
    'Lignes slog du service newsletter-console (requêtes HTTP et étapes du pipeline).';

-- ------------------------------------------------------------
-- 4. RLS — lecture admin newsletter, écriture service_role uniquement
-- ------------------------------------------------------------
ALTER TABLE public.newsletter_send_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_send_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_api_logs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_admin_read_runs"   ON public.newsletter_send_runs;
DROP POLICY IF EXISTS "newsletter_admin_read_events" ON public.newsletter_send_events;
DROP POLICY IF EXISTS "newsletter_admin_read_logs"   ON public.newsletter_api_logs;

CREATE POLICY "newsletter_admin_read_runs"
    ON public.newsletter_send_runs FOR SELECT
    USING ((SELECT has_permission('stock.arrivage.newsletter.admin')));

CREATE POLICY "newsletter_admin_read_events"
    ON public.newsletter_send_events FOR SELECT
    USING ((SELECT has_permission('stock.arrivage.newsletter.admin')));

CREATE POLICY "newsletter_admin_read_logs"
    ON public.newsletter_api_logs FOR SELECT
    USING ((SELECT has_permission('stock.arrivage.newsletter.admin')));

-- Le service Go se connecte en pgx direct (service_role, sans contexte JWT) :
-- c'est le seul écrivain de ces trois tables.
DROP POLICY IF EXISTS "service_role_send_runs"   ON public.newsletter_send_runs;
DROP POLICY IF EXISTS "service_role_send_events" ON public.newsletter_send_events;
DROP POLICY IF EXISTS "service_role_api_logs"    ON public.newsletter_api_logs;

CREATE POLICY "service_role_send_runs"
    ON public.newsletter_send_runs FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "service_role_send_events"
    ON public.newsletter_send_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "service_role_api_logs"
    ON public.newsletter_api_logs FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 5. Rétention — réutilise la purge quotidienne existante
-- ------------------------------------------------------------
-- Les logs bruts tournent vite : 3 mois suffisent pour du diagnostic. Les runs
-- et leurs events sont l'historique métier, on les garde 12 mois comme le reste.
-- Les events ne sont pas listés : ils partent en cascade avec leur run.
INSERT INTO public.app_logs_retention_config (table_name, date_column, retention_months, extra_filter) VALUES
    ('newsletter_api_logs',  'ts',         3,  NULL),
    ('newsletter_send_runs', 'started_at', 12, NULL)
ON CONFLICT (table_name) DO NOTHING;
