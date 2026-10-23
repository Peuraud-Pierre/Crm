-- ============================================================
-- Alerte « le tableau a bougé, aucune newsletter n'est partie »
-- ============================================================
-- 20260817140000_newsletter_error_notification.sql alerte sur les lignes ERROR
-- du service. Mais la panne du 26/08 n'a produit aucune erreur : le webhook
-- Supabase ne partait plus, donc le service n'était même pas sollicité. Pas de
-- log, pas de run en échec, pas d'alerte — la seule trace était l'absence de
-- trace. Un admin ne l'a vu qu'en constatant qu'un mail attendu n'arrivait pas.
--
-- Cette migration surveille donc le silence lui-même : une modification du
-- tableau qui n'est suivie d'aucun run déclenché par webhook est anormale, quel
-- que soit le maillon rompu (trigger supprimé, token désynchronisé, proxy,
-- conteneur mort).
--
-- Choix de conception :
--
-- 1. Délai de grâce de 45 min avant de crier. La fenêtre de debounce du service
--    est de DEBOUNCE_SECONDS = 1200 s (20 min) et elle est REPOUSSÉE à chaque
--    nouvelle modification : juste après une saisie, l'absence de run est le
--    comportement normal. 45 min laisse passer une fenêtre pleine plus une
--    rafale d'éditions.
--
-- 2. On compare à la dernière modification, pas à un simple compteur : c'est
--    « aucun run APRÈS cette modification-là » qui caractérise la panne.
--
-- 3. Ciblage par user_id réel via users_with_permission, et déduplication par
--    titre — mêmes raisons qu'en 20260817140000 (le front ne re-fetche que ses
--    propres notifications, et le push web résout push_subscriptions.user_id).
--
-- Limite assumée : la détection s'appuie sur arrivage_manuel.updated_at, qui
-- couvre INSERT (DEFAULT now()) et UPDATE (trigger arrivage_manuel_updated_at)
-- mais pas DELETE. Une suppression seule, sans aucune autre modification, ne
-- sera pas surveillée.
--
-- Fichier rejouable (CREATE OR REPLACE / IF EXISTS / unschedule avant
-- schedule).
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_newsletter_webhook_silence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    -- Laisse passer une fenêtre de debounce complète (20 min) plus la marge
    -- d'une rafale d'éditions qui la repousse.
    c_grace  CONSTANT interval := INTERVAL '45 minutes';
    -- Au-delà, on considère que l'incident est connu : inutile de remonter
    -- éternellement une modification vieille de plusieurs jours.
    c_window CONSTANT interval := INTERVAL '24 hours';
    -- Une alerte par demi-journée tant que la panne dure.
    c_dedup  CONSTANT interval := INTERVAL '12 hours';
    c_perm   CONSTANT text     := 'stock.arrivage.newsletter.admin';

    v_last_edit timestamptz;
    v_title     text;
BEGIN
    -- Dernière modification suffisamment ancienne pour qu'un envoi ait dû
    -- partir.
    SELECT max(a.updated_at) INTO v_last_edit
    FROM public.arrivage_manuel a
    WHERE a.updated_at >= now() - c_window
      AND a.updated_at <= now() - c_grace;

    IF v_last_edit IS NULL THEN
        RETURN;
    END IF;

    -- Un run déclenché par le webhook après cette modification : la chaîne
    -- fonctionne, quel qu'ait été son résultat (un run en échec relève de
    -- l'alerte ERROR, pas de celle-ci).
    IF EXISTS (
        SELECT 1
        FROM public.newsletter_send_runs r
        WHERE r.trigger = 'webhook'
          AND r.started_at >= v_last_edit
    ) THEN
        RETURN;
    END IF;

    -- Titre stable = clé de déduplication. Le préfixe « Newsletter : » n'est
    -- pas cosmétique : NotificationCenter scinde sur le premier « : » pour
    -- composer un libellé en gras suivi du détail.
    v_title := 'Newsletter : tableau modifié mais aucun envoi automatique déclenché';

    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/arrivage-admin/logs'
    FROM public.users_with_permission(c_perm) u
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_dedup
    );
END;
$$;

COMMENT ON FUNCTION public.notify_newsletter_webhook_silence() IS
    'Alerte les détenteurs de stock.arrivage.newsletter.admin quand arrivage_manuel a été modifiée sans qu''aucun run newsletter déclenché par webhook ne suive. Détecte la rupture silencieuse du Database Webhook.';

-- SECURITY DEFINER : seul le cron doit pouvoir l'appeler.
REVOKE EXECUTE ON FUNCTION public.notify_newsletter_webhook_silence() FROM PUBLIC;

DO $$
DECLARE
    v_role text;
BEGIN
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
            EXECUTE format(
                'REVOKE EXECUTE ON FUNCTION public.notify_newsletter_webhook_silence() FROM %I',
                v_role
            );
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- Planification pg_cron — toutes les heures, minute 35
-- ------------------------------------------------------------
-- Décalé de arrivage-status-auto ('5 * * * *', cf.
-- 20260707140000_arrivage_status_auto_cron.sql) pour ne pas évaluer le silence
-- au moment précis où ce cron vient d'écrire dans la table.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'newsletter-webhook-silence') THEN
            PERFORM cron.unschedule('newsletter-webhook-silence');
        END IF;
        PERFORM cron.schedule(
            'newsletter-webhook-silence',
            '35 * * * *',
            $cmd$ SELECT public.notify_newsletter_webhook_silence(); $cmd$
        );
    ELSE
        RAISE NOTICE 'pg_cron absent : planifier notify_newsletter_webhook_silence() autrement.';
    END IF;
END $$;
