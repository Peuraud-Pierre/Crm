-- ============================================================
-- Watchdog pg_net — détecte une file bloquée, relance le worker, alerte
-- ============================================================
-- Incident du 26/08. Le worker pg_net s'est arrêté sans rien signaler. Il n'y
-- a eu ni erreur SQL, ni exception, ni ligne de log : les triggers ont continué
-- d'empiler leurs requêtes dans net.http_request_queue, et plus rien n'en est
-- sorti. Constaté le 27/08 au matin, 295 requêtes en attente, ids 6180 à 6474
-- strictement contigus — aucune n'avait été traitée depuis la 6180.
--
-- Ce que ça avait coupé, en silence, pendant toute la durée de la panne :
--
--   277  http://main_server:8082/api/notify/send        notifications push
--    14  https://info.nokk-project.example/no_repleid_rdv confirmations de RDV
--     4  https://newsletter.nokk-project.example/webhook  newsletter arrivage
--
-- Autrement dit : TOUT le sortant HTTP de la base. Le symptôme remonté était
-- « la newsletter ne part plus », qui n'en était que la part visible.
--
-- Le worker ne fait plus non plus le ménage de sa propre file quand il est
-- mort : la file grossit indéfiniment, ce qui est le seul indice observable.
-- C'est sur lui que ce watchdog s'appuie.
--
-- ── Méthode de détection ────────────────────────────────────────────────────
-- net.http_request_queue n'a pas d'horodatage : impossible de dire « cette
-- requête attend depuis X ». On observe donc la PROGRESSION plutôt que l'âge.
-- Les ids sont croissants et le worker dépile dans l'ordre, donc min(id) doit
-- avancer tant qu'il travaille. Un min(id) figé sur une file non vide, au-delà
-- de la fenêtre de grâce, ne peut signifier qu'une chose : plus personne ne
-- dépile.
--
-- La fenêtre de grâce (5 min) est très large devant le timeout d'une requête
-- (5 à 10 s) : un simple pic de lenteur ne peut pas la déclencher.
--
-- ── Pourquoi l'alerte, elle, passe ──────────────────────────────────────────
-- Elle n'emprunte pas le canal en panne. public.notification est une table :
-- la cloche in-app se remplit même quand pg_net est mort. Seul le push web,
-- qui sort par main_server, restera bloqué — ce qui est précisément le défaut
-- qu'on cherche à contourner.
--
-- ── Périmètre ───────────────────────────────────────────────────────────────
-- Ce watchdog n'est pas propre à la newsletter. Il surveille pg_net pour tout
-- le projet, d'où le ciblage sur manager.console en plus des admins
-- newsletter.
--
-- Complément, côté newsletter uniquement :
-- 20260826121000_newsletter_webhook_silence_alert.sql, qui détecte l'absence
-- de diffusion après une modification du tableau — le symptôme métier, quand
-- bien même la cause serait ailleurs.
--
-- Fichier rejouable.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;


-- ------------------------------------------------------------
-- 1. Mémoire du watchdog
-- ------------------------------------------------------------
-- Une seule ligne : la détection est un différentiel entre deux passages, il
-- faut donc retenir le passage précédent. Le CHECK sur la clé primaire
-- interdit structurellement une deuxième ligne.
CREATE TABLE IF NOT EXISTS public.pg_net_watchdog_state (
    id               boolean PRIMARY KEY DEFAULT true CHECK (id),
    /** Plus petit id vu dans la file au dernier passage. NULL = file vide. */
    last_min_id      bigint,
    /** Dernier instant où la file a effectivement avancé. */
    last_progress_at timestamptz NOT NULL DEFAULT now(),
    /** Dernier redémarrage déclenché par le watchdog. */
    last_restart_at  timestamptz,
    /** Compteur cumulé — un chiffre qui grimpe désigne un problème de fond. */
    restart_count    integer NOT NULL DEFAULT 0
);

-- Ajoutée après coup : voir le bloc « série d'échecs » dans le watchdog.
ALTER TABLE public.pg_net_watchdog_state
    ADD COLUMN IF NOT EXISTS stall_streak integer NOT NULL DEFAULT 0;

INSERT INTO public.pg_net_watchdog_state (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Table technique : personne n'y accède depuis le client.
ALTER TABLE public.pg_net_watchdog_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pg_net_watchdog_state IS
    'État du watchdog pg_net (ligne unique). Sert à comparer deux passages du cron pour distinguer une file qui avance d''une file bloquée.';


-- ------------------------------------------------------------
-- 2. Le watchdog
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pg_net_watchdog()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    -- Durée pendant laquelle min(id) doit rester figé avant qu'on conclue à
    -- un arrêt. Large devant le timeout d'une requête, courte devant la durée
    -- d'un incident (la panne du 26/08 a duré des heures).
    c_grace   CONSTANT interval := INTERVAL '5 minutes';
    -- Une panne qui dure ne doit pas produire une notification par passage.
    c_dedup   CONSTANT interval := INTERVAL '1 hour';
    c_perm_ops   CONSTANT text := 'manager.console';
    c_perm_news  CONSTANT text := 'stock.arrivage.newsletter.admin';

    v_min_id    bigint;
    v_count     bigint;
    v_state     public.pg_net_watchdog_state%ROWTYPE;
    -- Au-delà de ce nombre de relances infructueuses sur le MÊME min(id), on
    -- cesse de relancer : la cause n'est pas un worker à réveiller.
    c_max_tries CONSTANT integer := 3;

    v_restarted boolean := false;
    v_error     text    := NULL;
    v_title     text;
    v_streak    integer;
    v_giveup    boolean := false;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'net'
    ) THEN
        RETURN jsonb_build_object('state', 'pg_net_absent');
    END IF;

    SELECT count(*), min(q.id)
      INTO v_count, v_min_id
      FROM net.http_request_queue q;

    SELECT * INTO v_state FROM public.pg_net_watchdog_state WHERE id;

    -- File vide : le worker a tout dépilé, c'est le cas nominal.
    IF v_count = 0 THEN
        UPDATE public.pg_net_watchdog_state
           SET last_min_id = NULL, last_progress_at = now(), stall_streak = 0
         WHERE id;
        RETURN jsonb_build_object('state', 'idle', 'queue_depth', 0);
    END IF;

    -- min(id) a bougé depuis le dernier passage : le worker travaille. Une
    -- file profonde n'est pas en soi une anomalie — une rafale légitime
    -- (import, envoi groupé) en crée une qui se résorbe.
    IF v_state.last_min_id IS DISTINCT FROM v_min_id THEN
        UPDATE public.pg_net_watchdog_state
           SET last_min_id = v_min_id, last_progress_at = now(), stall_streak = 0
         WHERE id;
        RETURN jsonb_build_object(
            'state', 'draining',
            'queue_depth', v_count,
            'oldest_id', v_min_id
        );
    END IF;

    -- Figé, mais pas encore assez longtemps pour conclure.
    IF now() - v_state.last_progress_at <= c_grace THEN
        RETURN jsonb_build_object(
            'state', 'watching',
            'queue_depth', v_count,
            'oldest_id', v_min_id,
            'stalled_for_s',
                EXTRACT(epoch FROM now() - v_state.last_progress_at)::int
        );
    END IF;

    -- ── Arrêt confirmé ─────────────────────────────────────────────────────
    -- Deux situations très différentes se cachent derrière « le worker ne
    -- dépile plus », et une seule est réparable d'ici :
    --
    --   a) le worker tourne mais s'est mis en défaut → worker_restart() le
    --      relance, c'est réglé sans intervention ;
    --   b) le processus a CRASHÉ et n'existe plus (journal Postgres :
    --      « background worker "pg_net … worker" exited with exit code 1 »)
    --      → worker_restart() envoie un signal à un processus disparu : elle
    --      n'échoue pas, elle ne fait simplement rien. Seul un redémarrage de
    --      l'instance réenregistre un background worker.
    --
    -- Constaté le 27/08 : c'était le cas (b), et plusieurs worker_restart()
    -- successifs n'ont rien changé. D'où la vérification APRÈS coup — sans
    -- elle, le watchdog notifierait « worker relancé » à chaque passage sur
    -- une panne qu'il n'a pas corrigée, ce qui est pire que de se taire.
    -- ── Série d'échecs ─────────────────────────────────────────────────────
    -- Un min(id) figé ne veut pas toujours dire « worker endormi ». Observé le
    -- 27/08 : le worker crashait et redémarrait tout seul (des requêtes plus
    -- récentes passaient en 200 pendant que les anciennes restaient), et les
    -- 295 lignes bloquées étaient des ORPHELINES — en vol au moment d'un
    -- crash, jamais reprises. Une file orpheline ne se résorbera jamais : sans
    -- ce garde-fou, le watchdog relancerait le worker et notifierait en boucle,
    -- pour toujours, sur un incident déjà terminé.
    --
    -- Trois tentatives suffisent à trancher : si le worker était simplement
    -- endormi, la première l'aura réveillé.
    v_streak := COALESCE(v_state.stall_streak, 0) + 1;
    v_giveup := v_streak > c_max_tries;

    IF NOT v_giveup THEN
        BEGIN
            PERFORM net.worker_restart();
            v_restarted := true;
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
        END;
    END IF;

    -- check_worker_is_up() lève une exception si le worker est absent
    -- (pg_net >= 0.10 environ). Son absence ne doit pas faire échouer le
    -- watchdog : on retombe alors sur le résultat brut de worker_restart().
    IF v_restarted THEN
        BEGIN
            PERFORM net.check_worker_is_up();
        EXCEPTION
            WHEN undefined_function THEN
                NULL; -- version trop ancienne : rien à conclure
            WHEN OTHERS THEN
                v_restarted := false;
                v_error := 'worker toujours absent après restart : ' || SQLERRM;
        END;
    END IF;

    -- last_progress_at est repoussé même en cas d'échec du restart : sinon le
    -- watchdog retenterait à chaque passage du cron au lieu d'attendre une
    -- nouvelle fenêtre de grâce.
    UPDATE public.pg_net_watchdog_state
       SET last_progress_at = now(),
           stall_streak     = v_streak,
           last_restart_at  = CASE WHEN v_restarted THEN now()
                                   ELSE last_restart_at END,
           restart_count    = restart_count + CASE WHEN v_restarted THEN 1
                                                   ELSE 0 END
     WHERE id;

    -- Le titre est la clé de déduplication : stable, sans compteur ni
    -- horodatage. Le préfixe avant « : » n'est pas cosmétique — le
    -- NotificationCenter scinde dessus pour composer un libellé en gras suivi
    -- d'un détail (extractNotificationDetails).
    v_title := CASE
        -- Relances épuisées : ce ne sont pas des requêtes en attente, ce sont
        -- des orphelines qu'aucun worker ne reprendra. Il faut purger.
        WHEN v_giveup
            THEN 'Infrastructure : file pg_net bloquée durablement, purge manuelle requise'
        WHEN v_restarted
            THEN 'Infrastructure : file pg_net bloquée, worker relancé automatiquement'
        -- Le worker ne répond même plus au signal : processus disparu.
        ELSE 'Infrastructure : worker pg_net arrêté, redémarrage de l''instance requis'
    END;

    -- Deux audiences, deux destinations. Les exploitants d'abord : la panne
    -- est technique et globale. Le second INSERT voit les lignes du premier
    -- (même transaction), donc quelqu'un qui détient les deux permissions
    -- n'est notifié qu'une fois.
    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/error-console'
    FROM public.users_with_permission(c_perm_ops) u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_dedup
    );

    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/arrivage-admin'
    FROM public.users_with_permission(c_perm_news) u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_dedup
    );

    RETURN jsonb_build_object(
        'state', CASE WHEN v_giveup THEN 'orphaned' ELSE 'stalled' END,
        'queue_depth', v_count,
        'oldest_id', v_min_id,
        'stall_streak', v_streak,
        'restarted', v_restarted,
        'error', v_error
    );
END;
$function$;

COMMENT ON FUNCTION public.pg_net_watchdog() IS
    'Détecte une file pg_net qui n''avance plus (min(id) figé au-delà de 5 min sur une file non vide), relance le worker et notifie manager.console et stock.arrivage.newsletter.admin. Appelé par le cron pg-net-watchdog.';

-- Seul le cron l'appelle.
REVOKE EXECUTE ON FUNCTION public.pg_net_watchdog() FROM PUBLIC;

DO $$
DECLARE
    v_role text;
BEGIN
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
            EXECUTE format(
                'REVOKE EXECUTE ON FUNCTION public.pg_net_watchdog() FROM %I',
                v_role
            );
        END IF;
    END LOOP;
END $$;


-- ------------------------------------------------------------
-- 3. Lecture de l'état, pour le dashboard
-- ------------------------------------------------------------
-- Fonction de LECTURE SEULE, exposée au front (permission
-- stock.arrivage.newsletter.admin). Elle ne relance rien : le dashboard
-- affiche, le cron répare.
CREATE OR REPLACE FUNCTION public.pg_net_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    c_perm CONSTANT text := 'stock.arrivage.newsletter.admin';
    v_count bigint;
    v_min   bigint;
    v_state public.pg_net_watchdog_state%ROWTYPE;
BEGIN
    IF NOT public.has_permission(c_perm) THEN
        RAISE EXCEPTION 'Permission % requise.', c_perm
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'net'
    ) THEN
        RETURN jsonb_build_object('available', false);
    END IF;

    SELECT count(*), min(q.id) INTO v_count, v_min
      FROM net.http_request_queue q;

    SELECT * INTO v_state FROM public.pg_net_watchdog_state WHERE id;

    RETURN jsonb_build_object(
        'available',   true,
        'queue_depth', v_count,
        'oldest_id',   v_min,
        -- Vrai dès que la file stagne au-delà de la grâce du watchdog : le
        -- dashboard n'attend pas le prochain passage du cron pour le dire.
        'stalled',     v_count > 0
                       AND v_state.last_min_id IS NOT DISTINCT FROM v_min
                       AND now() - v_state.last_progress_at > INTERVAL '5 minutes',
        -- Le watchdog a renoncé à relancer : les lignes restantes sont des
        -- orphelines, pas une file en attente. Seule une purge les enlèvera.
        'orphaned',    COALESCE(v_state.stall_streak, 0) > 3,
        'stalled_since',   v_state.last_progress_at,
        'last_restart_at', v_state.last_restart_at,
        'restart_count',   v_state.restart_count
    );
END;
$function$;

COMMENT ON FUNCTION public.pg_net_health() IS
    'Lecture seule de l''état de la file pg_net pour le dashboard /arrivage-admin. Ne répare rien.';

REVOKE ALL ON FUNCTION public.pg_net_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pg_net_health() TO authenticated;


-- ------------------------------------------------------------
-- 4. Planification — toutes les 2 minutes
-- ------------------------------------------------------------
-- La vérification est un count() sur une file normalement vide ou courte :
-- assez peu coûteuse pour tourner souvent. Avec 5 min de grâce, un arrêt est
-- détecté et réparé en 5 à 7 minutes, contre des heures le 26/08.
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
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pg-net-watchdog') THEN
            PERFORM cron.unschedule('pg-net-watchdog');
        END IF;
        PERFORM cron.schedule(
            'pg-net-watchdog',
            '*/2 * * * *',
            $cmd$ SELECT public.pg_net_watchdog(); $cmd$
        );
    ELSE
        RAISE NOTICE 'pg_cron absent : planifier public.pg_net_watchdog() autrement.';
    END IF;
END $$;


-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   select public.pg_net_watchdog();      -- 'idle' si la file est vide
--   select public.pg_net_health();
--   select jobname, schedule, active from cron.job
--    where jobname in ('pg-net-watchdog', 'newsletter-webhook-silence');
--
-- Test du chemin d'alerte, sans casser quoi que ce soit : forcer l'état à un
-- passé lointain avec une file non vide, puis appeler le watchdog.
--   update public.pg_net_watchdog_state
--      set last_progress_at = now() - interval '1 hour';
--   select public.pg_net_watchdog();
