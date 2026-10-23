-- ============================================================
-- Webhook « modification du tableau arrivage → newsletter-console »
-- ============================================================
-- Ce trigger est le seul déclencheur de l'envoi AUTOMATIQUE de la newsletter
-- arrivages. Jusqu'ici il n'existait que comme entrée Dashboard > Database >
-- Webhooks : versionné nulle part, recréé par rien, testé par rien.
--
-- Conséquence observée le 26/08 : plus aucun mail ne partait sur modification
-- du tableau, alors que l'envoi manuel à tous (POST /pipeline/trigger) et le
-- renvoi ciblé (POST /subscribers/{id}/resend) fonctionnaient parfaitement —
-- ces deux chemins n'empruntent pas le webhook. Une suppression ou une
-- désactivation du hook (clic Dashboard, DROP … CASCADE, recréation de table,
-- restauration de base) ne laisse aucune trace : ni erreur, ni run en échec
-- dans newsletter_send_runs, ni ligne dans newsletter_api_logs.
--
-- Le hook vit donc désormais ici.
--
-- ── Chaîne complète, pour mémoire ───────────────────────────────────────────
--   UPDATE arrivage_manuel
--     → ce trigger (pg_net, asynchrone)
--     → POST <API>/webhook  header x-webhook-token
--     → newsletter-console : internal/webhook.NewHandler
--         · compare le token à WEBHOOK_SECRET (401 sinon)
--         · ne réagit QUE si payload.table = 'arrivage_manuel'
--     → internal/debounce : fenêtre DEBOUNCE_SECONDS (1200 s par défaut),
--       relancée à chaque nouvelle modification
--     → internal/pipeline.RunAll : un Excel personnalisé par abonné, envoyé
--       aux lignes de newsletter_subscriptions avec active = true AND
--       arrivage = true
--
-- ── AVANT D'APPLIQUER ───────────────────────────────────────────────────────
-- 1. Vérifier ce qui existe déjà. Si un trigger appelant
--    supabase_functions.http_request est encore présent sur la table, relever
--    sa définition et reprendre SES valeurs ci-dessous plutôt que d'en
--    inventer de nouvelles :
--
--      select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
--      from pg_trigger t
--      join pg_class c     on c.oid = t.tgrelid
--      join pg_namespace n on n.oid = c.relnamespace
--      where n.nspname = 'public'
--        and c.relname = 'arrivage_manuel'
--        and not t.tgisinternal;
--
--    tgenabled = 'D' signifie « trigger désactivé » : dans ce cas la cause est
--    trouvée et ce fichier le recrée actif.
--
-- 2. Renseigner les deux valeurs du bloc ci-dessous. Elles ne sont
--    volontairement PAS committées : le token vaut le WEBHOOK_SECRET du
--    service et n'a rien à faire dans le dépôt.
--      · v_url    = URL publique du service (celle que le reverse proxy route
--                   vers le conteneur, qui n'écoute que sur 127.0.0.1)
--      · v_secret = valeur du secret CI WEBHOOK_SECRET, à l'identique
--
-- Fichier rejouable : le DROP … IF EXISTS en tête le rend idempotent.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
    -- ⚠️ À renseigner avant exécution. Ne pas committer les valeurs réelles.
    v_url    text := 'https://REMPLACER.example.com/webhook';
    v_secret text := 'REMPLACER_PAR_WEBHOOK_SECRET';
BEGIN
    IF v_url LIKE '%REMPLACER%' OR v_secret LIKE '%REMPLACER%' THEN
        RAISE EXCEPTION
            'Renseigner v_url et v_secret avant d''appliquer cette migration (voir l''en-tête du fichier).';
    END IF;

    -- supabase_functions n'existe que si la fonctionnalité Database Webhooks a
    -- été activée sur le projet. Sans ce garde, l'échec se manifesterait par un
    -- « function does not exist » peu parlant.
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_functions') THEN
        RAISE EXCEPTION
            'Schéma supabase_functions absent : activer Database Webhooks dans le Dashboard Supabase, puis rejouer cette migration.';
    END IF;

    DROP TRIGGER IF EXISTS arrivage_manuel_newsletter_webhook ON public.arrivage_manuel;

    -- supabase_functions.http_request n'accepte que des littéraux : le trigger
    -- est donc construit par format(). C'est exactement ce que génère le
    -- Dashboard pour un Database Webhook, à ceci près que sa définition est
    -- maintenant reproductible.
    --
    -- FOR EACH ROW, comme le Dashboard : la fonction lit NEW/OLD pour composer
    -- les champs `record` / `old_record` du payload. Une modification en masse
    -- émet donc un POST par ligne — sans conséquence, le debounce du service
    -- les regroupe en un seul envoi.
    EXECUTE format(
        $fmt$
        CREATE TRIGGER arrivage_manuel_newsletter_webhook
            AFTER INSERT OR UPDATE OR DELETE ON public.arrivage_manuel
            FOR EACH ROW
            EXECUTE FUNCTION supabase_functions.http_request(
                %L,
                'POST',
                %L,
                '{}',
                '5000'
            )
        $fmt$,
        v_url,
        json_build_object(
            'Content-Type',    'application/json',
            'x-webhook-token', v_secret
        )::text
    );
END $$;

COMMENT ON TRIGGER arrivage_manuel_newsletter_webhook ON public.arrivage_manuel IS
    'Déclenche l''envoi automatique de la newsletter arrivages (service newsletter-console, POST /webhook). Seul déclencheur automatique : sa suppression arrête les envois en silence.';

-- ── Vérification immédiate ──────────────────────────────────────────────────
-- Après application :
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.arrivage_manuel'::regclass and not tgisinternal;
--     → arrivage_manuel_newsletter_webhook doit apparaître avec tgenabled = 'O'
--
-- Puis modifier une ligne du tableau et lire la réponse du service :
--   select status_code, error_msg, created
--   from net._http_response order by created desc limit 5;
--     → 200 attendu. 401 = token désynchronisé de WEBHOOK_SECRET.
--       timeout/error_msg = le proxy ne route plus vers le conteneur.
