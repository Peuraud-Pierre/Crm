-- ============================================================
-- Ping du webhook « arrivage → newsletter-console »
-- ============================================================
-- Deux RPC de diagnostic, appelées depuis le bouton « Tester le webhook » de
-- /arrivage-admin (onglet Dashboard, carte « Service d'envoi »).
--
-- ── Pourquoi ────────────────────────────────────────────────────────────────
-- L'envoi AUTOMATIQUE de la newsletter dépend d'une chaîne que rien
-- n'observait :
--
--   UPDATE arrivage_manuel
--     → trigger arrivage_manuel_newsletter_webhook
--     → supabase_functions.http_request → file pg_net (net.http_request_queue)
--     → worker pg_net → POST <API>/webhook  (header x-webhook-token)
--     → reverse proxy → conteneur newsletter_console (écoute sur 127.0.0.1)
--     → internal/webhook.NewHandler → debounce → pipeline
--
-- Quand un maillon lâche, l'incident est MUET : pas d'erreur SQL, pas de run
-- en échec dans newsletter_send_runs, pas de ligne dans newsletter_api_logs.
-- Le renvoi ciblé et l'envoi manuel à tous continuent de marcher — ils
-- n'empruntent pas ce chemin — ce qui masque encore la panne. Constaté le
-- 26/08 : le tableau a été modifié plusieurs fois sans qu'aucun mail ne parte
-- et sans qu'aucune trace n'apparaisse nulle part.
--
-- ── Ce que le ping teste réellement ─────────────────────────────────────────
--   ✔ le trigger existe sur la table, et son état (actif / DÉSACTIVÉ)
--   ✔ pg_net accepte la requête et son worker la dépile
--   ✔ le reverse proxy route jusqu'au conteneur (DNS, TLS, port)
--   ✔ le service répond, et le x-webhook-token correspond à WEBHOOK_SECRET
--       (401 = secrets désynchronisés entre le Dashboard et la CI)
--
--   ✘ il ne prouve PAS que Postgres déclenche bien le trigger sur un UPDATE
--     réel : le ping rejoue l'appel HTTP du trigger, il ne l'exécute pas.
--     Le seul test qui couvre ce dernier point reste une vraie modification
--     du tableau.
--
-- ── Deux fonctions, et non une ──────────────────────────────────────────────
-- pg_net est asynchrone et n'insère dans net.http_request_queue QUE dans la
-- transaction courante : son worker ne voit la requête qu'après le COMMIT.
-- Une seule fonction qui posterait puis attendrait la réponse en boucle ne
-- verrait donc jamais rien. D'où la séparation : ping_newsletter_webhook()
-- poste (et sa transaction se termine), check_newsletter_webhook_ping() relit
-- ensuite le résultat, appelée en polling par le front.
--
-- ── Aucun secret dans ce fichier ────────────────────────────────────────────
-- L'URL et le header x-webhook-token ne sont pas recopiés ici : ils sont lus
-- dans la définition du trigger lui-même (pg_get_triggerdef). Le ping utilise
-- donc EXACTEMENT ce que le trigger utilise — si les deux divergeaient, le
-- test ne vaudrait rien. Le token n'est jamais renvoyé au client.
--
-- Fichier rejouable (CREATE OR REPLACE).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;


-- ── 1. Poster le ping ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ping_newsletter_webhook()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    c_perm CONSTANT text := 'stock.arrivage.newsletter.admin';
    v_name     text;
    v_enabled  "char";
    v_def      text;
    v_args     text[];
    v_url      text;
    v_headers  text;
    v_timeout  int;
    v_req_id   bigint;
BEGIN
    IF NOT public.has_permission(c_perm) THEN
        RAISE EXCEPTION 'Permission % requise.', c_perm
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'net'
    ) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'reason', 'pg_net_absent',
            'message', 'Extension pg_net absente : aucun appel HTTP sortant '
                       || 'n''est possible depuis la base.'
        );
    END IF;

    -- Le webhook Supabase est un trigger ordinaire dont la fonction est
    -- supabase_functions.http_request. On le cherche par sa fonction plutôt
    -- que par son nom : le nom dépend de ce qui a été saisi dans le Dashboard.
    SELECT t.tgname, t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid)
      INTO v_name, v_enabled, v_def
      FROM pg_catalog.pg_trigger    t
      JOIN pg_catalog.pg_class      c  ON c.oid  = t.tgrelid
      JOIN pg_catalog.pg_namespace  n  ON n.oid  = c.relnamespace
      JOIN pg_catalog.pg_proc       p  ON p.oid  = t.tgfoid
      JOIN pg_catalog.pg_namespace  pn ON pn.oid = p.pronamespace
     WHERE n.nspname  = 'public'
       AND c.relname  = 'arrivage_manuel'
       AND NOT t.tgisinternal
       AND pn.nspname = 'supabase_functions'
       AND p.proname  = 'http_request'
     LIMIT 1;

    IF v_name IS NULL THEN
        -- Cause n°1 de la panne : le hook a été supprimé (clic Dashboard,
        -- DROP ... CASCADE, recréation de table, restauration de base).
        RETURN jsonb_build_object(
            'ok', false,
            'reason', 'trigger_absent',
            'trigger_found', false,
            'message', 'Aucun trigger de webhook sur public.arrivage_manuel : '
                       || 'l''envoi automatique ne peut pas se déclencher.'
        );
    END IF;

    -- 'O' = actif. 'D' = désactivé (ALTER TABLE ... DISABLE TRIGGER) : il
    -- existe toujours, le Dashboard l'affiche, et il ne part jamais.
    IF v_enabled = 'D' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'reason', 'trigger_disabled',
            'trigger_found', true,
            'trigger_name', v_name,
            'message', 'Le trigger ' || v_name || ' existe mais il est '
                       || 'DÉSACTIVÉ : il ne se déclenchera sur aucune '
                       || 'modification.'
        );
    END IF;

    -- Arguments de http_request(url, method, headers, params, timeout), tels
    -- que pg_get_triggerdef les restitue (littéraux SQL, quotes doublées).
    v_args := pg_catalog.regexp_match(
        v_def,
        'http_request\(\s*''(.+?)''\s*,\s*''(.+?)''\s*,\s*''(.+?)''\s*,\s*''(.*?)''\s*,\s*''(.+?)''\s*\)\s*$'
    );

    IF v_args IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'reason', 'trigger_unparsable',
            'trigger_found', true,
            'trigger_name', v_name,
            'message', 'Définition du trigger illisible : impossible d''en '
                       || 'extraire l''URL et les en-têtes.'
        );
    END IF;

    v_url     := pg_catalog.replace(v_args[1], '''''', '''');
    v_headers := pg_catalog.replace(v_args[3], '''''', '''');
    v_timeout := v_args[5]::int;

    -- `table` volontairement différent de 'arrivage_manuel' : le handler Go ne
    -- planifie une diffusion QUE pour cette table. Un ping ne doit jamais
    -- programmer un envoi réel — il traverse toute la chaîne (réseau, proxy,
    -- authentification par token) puis ressort en 200 sur la branche
    -- « webhook: table ignored », sans rien déclencher.
    v_req_id := net.http_post(
        url                  => v_url,
        body                 => jsonb_build_object(
                                    'type',   'PING',
                                    'table',  '__ping__',
                                    'schema', 'public',
                                    'record', '{}'::jsonb
                                ),
        params               => '{}'::jsonb,
        headers              => v_headers::jsonb,
        timeout_milliseconds => v_timeout
    );

    RETURN jsonb_build_object(
        'ok', true,
        'trigger_found', true,
        'trigger_name', v_name,
        'trigger_enabled', true,
        -- L'URL est affichable ; les en-têtes ne le sont pas, ils portent le
        -- x-webhook-token.
        'url', v_url,
        'request_id', v_req_id
    );
END;
$function$;


-- ── 2. Relire la réponse ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_newsletter_webhook_ping(p_request_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    c_perm CONSTANT text := 'stock.arrivage.newsletter.admin';
    v_status   int;
    v_timedout boolean;
    v_error    text;
    v_found    boolean;
    v_queued   boolean;
BEGIN
    IF NOT public.has_permission(c_perm) THEN
        RAISE EXCEPTION 'Permission % requise.', c_perm
            USING ERRCODE = '42501';
    END IF;

    SELECT true, r.status_code, r.timed_out, r.error_msg
      INTO v_found, v_status, v_timedout, v_error
      FROM net._http_response r
     WHERE r.id = p_request_id;

    IF v_found THEN
        RETURN jsonb_build_object(
            'state',       'done',
            'status_code', v_status,
            'timed_out',   COALESCE(v_timedout, false),
            'error_msg',   v_error
        );
    END IF;

    -- Pas encore de réponse : la requête est-elle toujours dans la file ?
    SELECT EXISTS (
        SELECT 1 FROM net.http_request_queue q WHERE q.id = p_request_id
    ) INTO v_queued;

    -- Une requête qui reste dans la file bien au-delà de son timeout signe un
    -- worker pg_net arrêté — panne silencieuse classique : plus aucun webhook
    -- ne part, et rien ne le signale. Remède : select net.worker_restart();
    RETURN jsonb_build_object(
        'state', CASE WHEN v_queued THEN 'queued' ELSE 'pending' END
    );
END;
$function$;


-- ── 3. Droits ───────────────────────────────────────────────────────────────
-- Le contrôle de permission est dans le corps des fonctions ; on retire tout
-- de même l'exécution à anon, qui n'a aucune raison de les atteindre.

REVOKE ALL ON FUNCTION public.ping_newsletter_webhook()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_newsletter_webhook_ping(bigint) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ping_newsletter_webhook()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_newsletter_webhook_ping(bigint) TO authenticated;

COMMENT ON FUNCTION public.ping_newsletter_webhook() IS
    'Diagnostic /arrivage-admin : rejoue l''appel HTTP du webhook arrivage avec les paramètres du trigger lui-même, sans programmer d''envoi. Renvoie un request_id à relire via check_newsletter_webhook_ping().';

COMMENT ON FUNCTION public.check_newsletter_webhook_ping(bigint) IS
    'Résultat d''un ping : state done/queued/pending. state=queued persistant = worker pg_net arrêté (select net.worker_restart()).';


-- ============================================================
-- Vérifier le maillon que le ping ne couvre pas
-- ============================================================
-- Le ping rejoue l'appel HTTP du trigger ; il ne prouve pas que Postgres
-- l'exécute sur un UPDATE réel. Sur une table de production qu'on ne veut pas
-- modifier, ce bloc le vérifie sans rien laisser derrière : le RAISE EXCEPTION
-- final annule la transaction entière — l'UPDATE, la requête que le trigger a
-- mise dans la file pg_net (transactionnelle, même si la table est UNLOGGED),
-- et tout ce que les autres triggers de la table ont écrit au passage.
--
-- Seul effet persistant : les séquences avancent d'un cran, ce qui est sans
-- conséquence. Rien n'est envoyé.
--
--   DO $$
--   DECLARE
--       v_id     uuid;
--       v_before bigint;
--       v_after  bigint;
--       v_url    text;
--   BEGIN
--       SELECT count(*) INTO v_before FROM net.http_request_queue;
--
--       SELECT a.id INTO v_id FROM public.arrivage_manuel a LIMIT 1;
--       IF v_id IS NULL THEN
--           RAISE EXCEPTION 'Table vide, test impossible.';
--       END IF;
--
--       -- Le trigger BEFORE UPDATE remet updated_at à now() : la ligne change
--       -- réellement, donc le webhook part réellement.
--       UPDATE public.arrivage_manuel SET updated_at = updated_at WHERE id = v_id;
--
--       SELECT count(*), max(q.url) INTO v_after, v_url FROM net.http_request_queue;
--
--       RAISE EXCEPTION E'RÉSULTAT — file avant: % / après: %
URL: %
(annulé)',
--           v_before, v_after, COALESCE(v_url, '(aucune)');
--   END $$;
--
-- after = before + 1 avec l'URL du webhook → le trigger tire bien.
-- after = before                          → creuser session_replication_role.
