-- ============================================================
-- Mail au client quand l'horaire d'un RDV change
-- ============================================================
-- Un RDV déplacé ne prévenait personne : le client gardait en tête le créneau
-- de sa confirmation initiale. On veut le notifier, quel que soit le chemin —
-- formulaire d'édition, drag & drop dans l'agenda, resize, sync Apple/Outlook,
-- report côté Amelia. Tous passent par le même UPDATE de debut/fin, donc par
-- un trigger : le front n'en connaît qu'un seul.
--
-- ── Pourquoi une file différée plutôt qu'un envoi direct ─────────────────────
-- Le drag & drop produit une rafale d'UPDATE : on attrape un RDV, on l'ajuste
-- deux ou trois fois, on le repose. Un envoi immédiat expédierait un mail par
-- ajustement, dont les heures intermédiaires — le client recevrait trois
-- créneaux dont deux faux. Le dédoublonnage côté Go n'y peut rien : son
-- empreinte inclut la date et l'heure (cf. rdvFingerprint), donc chaque
-- ajustement lui paraît légitimement différent.
--
-- La file résout les deux problèmes d'un coup :
--   · une seule ligne par RDV (upsert sur l'id) — la rafale s'écrase ;
--   · l'échéance est REPOUSSÉE à chaque modification — tant que le RDV bouge,
--     rien ne part ; le compte à rebours ne va au bout qu'une fois posé ;
--   · l'horaire n'est lu qu'au moment de l'envoi, jamais au moment du trigger,
--     donc c'est toujours le créneau final qui part.
--
-- ── Facteur commun avec la confirmation ─────────────────────────────────────
-- La construction du payload et l'appel pg_net étaient jusqu'ici enfermés dans
-- function_call_go_api_on_new_event. Le job en a besoin à l'identique : on les
-- sort dans public.post_rdv_mail(uuid), seule fonction à connaître désormais
-- l'URL de l'API Go et la forme du corps. Les deux appelants — confirmation et
-- reprogrammation — ne peuvent plus diverger.
-- ============================================================

-- ─── Le facteur commun : construire et poster le mail d'un RDV ───────────────
-- Prend l'id plutôt que la ligne : le job doit relire l'état FRAIS au moment de
-- l'envoi, pas celui capturé à l'instant du trigger.
-- SECURITY DEFINER : la fonction lit client_crm et Event_calendar et appelle
-- net.http_post. Appelée depuis un trigger, elle s'exécuterait sinon avec les
-- droits du commercial — RLS masquerait des lignes (mail silencieusement non
-- envoyé) et le schéma net lui est de toute façon fermé.
CREATE OR REPLACE FUNCTION public.post_rdv_mail(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event        record;
    v_client_mail  text;
    v_client_brief jsonb;
    v_lang         text := 'fr';
    v_payload      jsonb;
BEGIN
    SELECT id, nom, debut, client, creator_id, id_client, confirmed
      INTO v_event
      FROM public."Event_calendar"
     WHERE id = p_event_id;

    -- RDV supprimé entre la mise en file et l'envoi.
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF NOT v_event.confirmed OR v_event.nom IS NOT DISTINCT FROM 'Non Disponible' THEN
        RETURN false;
    END IF;

    SELECT mail, brief INTO v_client_mail, v_client_brief
      FROM public.client_crm
     WHERE id = v_event.id_client;

    IF v_client_mail IS NULL OR length(v_client_mail) = 0 THEN
        RETURN false;
    END IF;

    -- Langue déduite du brief (ILIKE : insensible à la casse).
    IF v_client_brief::text ILIKE '%"language":"en"%'
       OR v_client_brief::text ILIKE '%"langue":"en"%' THEN
        v_lang := 'en';
    END IF;

    v_payload := jsonb_build_object(
        'client_email', v_client_mail,
        'client_nom',   COALESCE(v_event.client, 'Client'),
        'date_rdv',     to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
        'heure_rdv',    to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'HH24"h"MI'),
        'owner',        v_event.creator_id,
        'langue',       v_lang,
        'type_rdv',     COALESCE(v_event.nom, 'autre')
    );

    PERFORM net.http_post(
        url     := 'https://info.nokk-project.example/no_repleid_rdv',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := v_payload
    );

    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.post_rdv_mail(uuid) IS
    'Construit et poste le mail de confirmation de RDV vers l''API Go '
    '(/no_repleid_rdv) à partir de l''état COURANT de l''événement. Seul point '
    'du schéma qui connaît l''URL et la forme du payload. Retourne false si '
    'l''événement a disparu, n''est pas confirmé, est une indisponibilité, ou '
    'si le client n''a pas d''email.';

-- ─── La confirmation passe par le facteur commun ─────────────────────────────
-- Corps identique à 20260903130000, le bloc payload en moins.
CREATE OR REPLACE FUNCTION public.function_call_go_api_on_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dup_count int;
BEGIN
    -- Rien tant que le RDV n'est pas confirmé.
    IF NOT NEW.confirmed THEN
        RETURN NEW;
    END IF;

    -- Sur UPDATE : uniquement au passage effectif à confirmed = true.
    IF TG_OP = 'UPDATE' AND OLD.confirmed IS NOT DISTINCT FROM NEW.confirmed THEN
        RETURN NEW;
    END IF;

    -- Garde anti-doublon : même client, même créneau, inséré il y a moins de
    -- 2 minutes (double-submit, retry, Amelia + sync).
    SELECT count(*) INTO v_dup_count
      FROM public."Event_calendar"
     WHERE id_client = NEW.id_client
       AND debut     = NEW.debut
       AND id <> NEW.id
       AND created_at >= now() - interval '2 minutes';

    IF v_dup_count > 0 THEN
        RAISE NOTICE 'Doublon RDV ignoré (client=%, debut=%)', NEW.id_client, NEW.debut;
        RETURN NEW;
    END IF;

    PERFORM public.post_rdv_mail(NEW.id);

    RETURN NEW;
END;
$$;

-- ─── La file ─────────────────────────────────────────────────────────────────
-- Une ligne par RDV en attente de notification, jamais plus : l'id est la clé
-- primaire, donc une rafale de drags écrase sa propre entrée au lieu de
-- s'empiler. Table volontairement minimale — pas d'historique d'envoi ici, le
-- log vit côté API Go.
CREATE TABLE IF NOT EXISTS public.rdv_reschedule_mail_queue (
    event_id     uuid PRIMARY KEY
                 REFERENCES public."Event_calendar" (id) ON DELETE CASCADE,
    send_after   timestamptz NOT NULL,
    queued_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rdv_reschedule_mail_queue IS
    'Notifications de changement d''horaire en attente. Une ligne par RDV : '
    'chaque modification repousse send_after, si bien qu''une série '
    'd''ajustements au drag & drop ne produit qu''un seul mail, avec l''horaire '
    'final. Vidée par le cron rdv-reschedule-mail.';

CREATE INDEX IF NOT EXISTS rdv_reschedule_mail_queue_due_idx
    ON public.rdv_reschedule_mail_queue (send_after);

-- ─── Accès : personne, sauf les fonctions ────────────────────────────────────
-- File de travail interne, jamais lue par l'application. RLS activée SANS
-- aucune policy : c'est le réglage le plus fermé qui soit, tout accès par anon
-- ou authenticated (donc par PostgREST) est refusé.
--
-- Les fonctions ci-dessous continuent d'y écrire parce qu'elles sont
-- SECURITY DEFINER : elles s'exécutent sous le propriétaire de la table, et le
-- propriétaire est exempté de RLS tant qu'on ne pose pas FORCE ROW LEVEL
-- SECURITY. Sans cette élévation, RLS bloquerait l'INSERT du trigger et le
-- déplacement d'un RDV échouerait pour le commercial.
ALTER TABLE public.rdv_reschedule_mail_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rdv_reschedule_mail_queue FROM anon, authenticated;

-- Le délai de repos : au-delà, on considère le RDV posé. Assez long pour
-- couvrir une série d'ajustements, assez court pour que le client soit prévenu
-- tant que l'information est fraîche.
CREATE OR REPLACE FUNCTION public.queue_rdv_reschedule_mail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Seul un déplacement réel compte : un UPDATE qui réécrit debut/fin à
    -- l'identique (sauvegarde de formulaire sans changement d'heure) ne doit
    -- pas notifier.
    IF NEW.debut IS NOT DISTINCT FROM OLD.debut
       AND NEW.fin IS NOT DISTINCT FROM OLD.fin THEN
        RETURN NEW;
    END IF;

    -- Un RDV encore en attente de confirmation n'a jamais été annoncé au
    -- client : il n'y a pas d'horaire à corriger dans son esprit. Le mail
    -- partira à la confirmation, avec le bon créneau.
    IF NOT NEW.confirmed OR NEW.nom IS NOT DISTINCT FROM 'Non Disponible' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.rdv_reschedule_mail_queue (event_id, send_after)
    VALUES (NEW.id, now() + interval '3 minutes')
    ON CONFLICT (event_id) DO UPDATE
        SET send_after = excluded.send_after;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_rdv_reschedule_mail ON public."Event_calendar";

CREATE TRIGGER trg_queue_rdv_reschedule_mail
  AFTER UPDATE OF debut, fin ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_rdv_reschedule_mail();

-- ─── Le vidage de la file ────────────────────────────────────────────────────
-- DELETE ... RETURNING : la ligne est retirée dans la même transaction que
-- l'envoi. Deux passages du cron qui se chevaucheraient ne peuvent pas poster
-- deux fois le même RDV.
CREATE OR REPLACE FUNCTION public.flush_rdv_reschedule_mails()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r    record;
    n    int := 0;
BEGIN
    FOR r IN
        DELETE FROM public.rdv_reschedule_mail_queue
         WHERE send_after <= now()
        RETURNING event_id
    LOOP
        IF public.post_rdv_mail(r.event_id) THEN
            n := n + 1;
        END IF;
    END LOOP;

    RETURN n;
END;
$$;

COMMENT ON FUNCTION public.flush_rdv_reschedule_mails() IS
    'Poste les notifications de changement d''horaire arrivées à échéance et '
    'vide la file. Retourne le nombre de mails effectivement postés (les RDV '
    'supprimés ou sans email entre-temps sont retirés sans envoi).';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rdv-reschedule-mail') THEN
            PERFORM cron.unschedule('rdv-reschedule-mail');
        END IF;
        PERFORM cron.schedule(
            'rdv-reschedule-mail',
            '* * * * *',
            $cmd$ SELECT public.flush_rdv_reschedule_mails(); $cmd$
        );
    ELSE
        RAISE NOTICE 'pg_cron absent : planifier public.flush_rdv_reschedule_mails() autrement.';
    END IF;
END $$;

-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   -- déplacer un RDV confirmé, puis dans les 3 minutes :
--   select * from public.rdv_reschedule_mail_queue;      -- 1 ligne, send_after à venir
--   -- le déplacer à nouveau : toujours 1 ligne, send_after repoussé
--   select public.flush_rdv_reschedule_mails();          -- force l'envoi, renvoie 1
--   select jobname, schedule, active from cron.job where jobname = 'rdv-reschedule-mail';
