-- ============================================================
-- Correctif : la colonne « a confirmer » n'existe pas
-- ============================================================
-- 20260903120000 a recréé le trigger sur function_call_go_api_on_new_event en
-- conservant sa condition d'entrée historique, `NEW."a confirmer" = false`.
-- Cette colonne n'existe pas sur Event_calendar : en plpgsql un champ de NEW
-- n'est résolu qu'à l'exécution, la fonction pouvait donc rester en base des
-- mois sans que personne ne le voie tant qu'aucun trigger ne l'appelait.
--
-- Symptôme : déplacer un client dans le Kanban échouait en 42703
-- (« record "new" has no field "a confirmer" »). Le trigger Kanban
-- trg_confirm_events_on_client_column_change fait UPDATE ... SET confirmed,
-- ce qui réveillait ce trigger, qui plantait, et l'erreur remontait jusqu'à
-- l'UPDATE de client_crm.
--
-- Conséquence à retenir : ce trigger n'envoyait AUCUN mail avant aujourd'hui.
-- Le seul envoi réellement en service est le fetch côté front
-- (use_calendar.tsx, création d'un RDV depuis le CRM) — ce qui explique qu'un
-- RDV pris sur Amelia n'ait jamais généré de confirmation.
--
-- La condition est simplement retirée : son rôle (« RDV pas encore validé »)
-- est exactement celui repris par `confirmed`, que les gardes en tête de
-- fonction testent déjà. Seul le filtre sur 'Non Disponible' subsiste.
-- ============================================================

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
    -- 0. Rien tant que le RDV n'est pas confirmé : le prospect ne doit pas
    --    recevoir de confirmation pour un créneau encore en attente.
    IF NOT NEW.confirmed THEN
        RETURN NEW;
    END IF;

    -- 0bis. Sur UPDATE : uniquement au passage effectif à confirmed = true.
    --       Sans cette garde, chaque modification du RDV (déplacement dans
    --       l'agenda, changement de lieu…) renverrait le mail.
    IF TG_OP = 'UPDATE' AND OLD.confirmed IS NOT DISTINCT FROM NEW.confirmed THEN
        RETURN NEW;
    END IF;

    -- 1. Les créneaux d'indisponibilité ne concernent aucun client.
    IF NEW.nom IS DISTINCT FROM 'Non Disponible' THEN

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
