-- Garde anti-doublon sur l'envoi du mail de confirmation de RDV.
--
-- Contexte : le trigger `call_go_api_on_false` (AFTER INSERT ON Event_calendar)
-- appelle l'API Go /no_repleid_rdv via pg_net pour envoyer la confirmation au
-- client. Lorsqu'un même RDV est inséré deux fois à quelques secondes d'intervalle
-- (double-submit du front, retry, Amelia + sync), le trigger fire deux fois et le
-- client reçoit l'email en double.
--
-- On ajoute une garde : avant de poster, on vérifie qu'aucun autre événement
-- identique (même client, même créneau, non "à confirmer") n'a déjà été inséré
-- dans les 2 dernières minutes. Si c'est le cas, on n'envoie pas le second email.
--
-- Le corps de la fonction est par ailleurs inchangé.

create or replace function public.function_call_go_api_on_new_event()
returns trigger
language plpgsql
as $function$
DECLARE
    v_client_mail text;
    v_client_brief jsonb;
    v_lang text := 'fr';
    v_payload jsonb;
    v_dup_count int;
BEGIN
    -- 1. Conditions initiales : a_confirmer = false ET nom != 'Non Disponible'
    IF NEW."a confirmer" = false AND NEW.nom IS DISTINCT FROM 'Non Disponible' THEN

        -- 1bis. Garde anti-doublon : un autre event identique a-t-il déjà été
        -- inséré très récemment ? Si oui, on n'envoie pas le second email.
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

        -- 2. On récupère les infos du client lié à l'événement
        SELECT mail, brief INTO v_client_mail, v_client_brief
        FROM public.client_crm
        WHERE id = NEW.id_client;

        -- 3. Si on a bien un email
        IF v_client_mail IS NOT NULL AND length(v_client_mail) > 0 THEN

            -- 4. Détermination de la langue via le brief (ILIKE insensible à la casse)
            IF v_client_brief::text ILIKE '%"language":"en"%' OR v_client_brief::text ILIKE '%"langue":"en"%' THEN
                v_lang := 'en';
            END IF;

            -- 5. Construction du payload
            v_payload := jsonb_build_object(
                'client_email', v_client_mail,
                'client_nom',   COALESCE(NEW.client, 'Client'),
                'date_rdv',     to_char(NEW.debut AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
                'heure_rdv',    to_char(NEW.debut AT TIME ZONE 'Europe/Paris', 'HH24"h"MI'),
                'owner',        NEW.creator_id,
                'langue',       v_lang,
                'type_rdv',     COALESCE(NEW.nom, 'autre')
            );

            -- 6. Appel de l'API Go via pg_net
            PERFORM net.http_post(
                url     := 'https://info.nokk-project.example/no_repleid_rdv',
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body    := v_payload
            );

        END IF;

    END IF;

    RETURN NEW;
END;
$function$;
