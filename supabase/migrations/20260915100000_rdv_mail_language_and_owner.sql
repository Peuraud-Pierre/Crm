-- ============================================================
-- Mail RDV : langue lue dans le brief par clé, expert = commercial du RDV
-- ============================================================
-- post_rdv_mail cherchait '%"language":"en"%' dans brief::text. Or Postgres
-- sérialise un jsonb avec un espace après les deux-points :
--   '{"language":"EN"}'::jsonb::text  →  {"language": "EN"}
-- Le motif ne matchait donc jamais : un client anglophone recevait toujours la
-- confirmation et la reprogrammation en français (le rappel J-3, lui, parse le
-- JSON côté Go — cf. detectLangue — et partait bien en anglais).
--
-- On lit la clé avec ->>, comme le Go : même clés (language, puis langue),
-- même règle (préfixe « en », casse ignorée). Un brief absent, vide, scalaire
-- ou tableau donne NULL → 'fr', sans lever d'erreur dans le trigger.
--
-- Expert : `owner` était creator_id (qui a saisi le RDV) alors que le front
-- postait aussi le mail avec customer (le commercial). L'empreinte anti-doublon
-- Go incluant owner et motif, le client recevait deux mails, parfois avec deux
-- experts différents. Le front n'envoie plus rien (use_calendar.tsx) ; ce
-- trigger reste seul et cite le commercial, repli sur le créateur.
--
-- Même signature (uuid, text) : CREATE OR REPLACE suffit, les appelants
-- (function_call_go_api_on_new_event, flush_rdv_reschedule_mails) sont
-- inchangés. Corps identique à 20260903150000, blocs langue et owner exceptés.
-- ============================================================

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
    SELECT id, nom, debut, client, customer, creator_id, id_client, confirmed
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

    -- Langue déduite du brief ("EN" côté fiche CRM et bridge Amelia).
    IF lower(COALESCE(NULLIF(v_client_brief->>'language', ''),
                      v_client_brief->>'langue', '')) LIKE 'en%' THEN
        v_lang := 'en';
    END IF;

    v_payload := jsonb_build_object(
        'client_email', v_client_mail,
        'client_nom',   COALESCE(v_event.client, 'Client'),
        'date_rdv',     to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
        'heure_rdv',    to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'HH24"h"MI'),
        'owner',        COALESCE(v_event.customer, v_event.creator_id),
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

-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   -- clients que l'ancien test envoyait à tort en français :
--   select id, nom, brief->>'language'
--     from public.client_crm
--    where lower(coalesce(nullif(brief->>'language',''), brief->>'langue','')) like 'en%';
--   -- puis, sur un RDV confirmé de l'un d'eux, le log Go doit afficher Langue=en :
--   select public.post_rdv_mail('<id du RDV>');
