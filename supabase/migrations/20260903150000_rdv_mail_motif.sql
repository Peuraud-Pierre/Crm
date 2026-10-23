-- ============================================================
-- Distinguer confirmation et reprogrammation dans le mail envoyé
-- ============================================================
-- Jusqu'ici les deux envois empruntaient le même template : un client dont le
-- RDV était déplacé recevait un second mail intitulé « Confirmation », portant
-- une date différente du premier, sans rien qui dise lequel fait foi.
--
-- L'API Go sait désormais router sur un champ `motif` du payload
-- (mail_client/handler_rdv.go) : absent ou vide il garde les templates de
-- confirmation, "reprogrammation" bascule sur les templates « Nouvelle date »,
-- qui ouvrent par un bandeau invitant à ignorer la date précédente.
--
-- Compatible dans les deux sens de déploiement : un binaire Go antérieur
-- ignore simplement le champ inconnu, et cette fonction envoyée avant la mise
-- à jour du Go retombe sur l'ancien comportement. Aucune fenêtre de casse.
--
-- Le paramètre porte un DEFAULT, si bien que l'appel de
-- function_call_go_api_on_new_event (`post_rdv_mail(NEW.id)`) reste valide
-- sans être retouché — c'est la confirmation, et c'est le défaut.
-- ============================================================

-- DROP explicite : ajouter un paramètre change la signature, un simple CREATE
-- OR REPLACE laisserait les deux versions coexister et l'appel à un argument
-- deviendrait ambigu (42725).
DROP FUNCTION IF EXISTS public.post_rdv_mail(uuid);

CREATE OR REPLACE FUNCTION public.post_rdv_mail(
    p_event_id uuid,
    p_motif    text DEFAULT 'confirmation'
)
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
        'type_rdv',     COALESCE(v_event.nom, 'autre'),
        'motif',        p_motif
    );

    PERFORM net.http_post(
        url     := 'https://info.nokk-project.example/no_repleid_rdv',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := v_payload
    );

    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.post_rdv_mail(uuid, text) IS
    'Construit et poste le mail de RDV vers l''API Go (/no_repleid_rdv) à '
    'partir de l''état COURANT de l''événement. p_motif = ''confirmation'' '
    '(défaut) ou ''reprogrammation'', qui sélectionne le template côté Go. '
    'Seul point du schéma qui connaît l''URL et la forme du payload. Retourne '
    'false si l''événement a disparu, n''est pas confirmé, est une '
    'indisponibilité, ou si le client n''a pas d''email.';

-- ─── La file annonce désormais une reprogrammation ───────────────────────────
CREATE OR REPLACE FUNCTION public.flush_rdv_reschedule_mails()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r record;
    n int := 0;
BEGIN
    FOR r IN
        DELETE FROM public.rdv_reschedule_mail_queue
         WHERE send_after <= now()
        RETURNING event_id
    LOOP
        IF public.post_rdv_mail(r.event_id, 'reprogrammation') THEN
            n := n + 1;
        END IF;
    END LOOP;

    RETURN n;
END;
$$;

-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   -- une confirmation ne porte pas de motif de reprogrammation :
--   select public.post_rdv_mail('<id d''un RDV confirmé>');            -- motif = confirmation
--   select public.post_rdv_mail('<id>', 'reprogrammation');            -- motif = reprogrammation
--   select proname, pg_get_function_identity_arguments(oid)
--     from pg_proc where proname = 'post_rdv_mail';                    -- une seule ligne
