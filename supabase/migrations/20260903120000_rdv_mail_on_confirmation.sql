-- ============================================================
-- Mail de confirmation de RDV : à la confirmation, plus à l'insertion
-- ============================================================
-- `function_call_go_api_on_new_event` (cf. 20260623130000) poste vers l'API Go
-- /no_repleid_rdv en AFTER INSERT. Depuis l'introduction de `confirmed`
-- (20260831130000), un RDV pris sur Amelia existe en base dès la réservation
-- mais reste en attente de validation par le commercial : le prospect recevait
-- donc son mail de confirmation pour un rendez-vous que personne n'avait
-- encore accepté.
--
-- La condition d'entrée historique porte sur "a confirmer" (colonne legacy,
-- antérieure aux migrations versionnées, DEFAULT false) — aucun code ne l'écrit,
-- tous les INSERT prennent son défaut, ce qui explique que le trigger parte sur
-- chaque création. Elle est conservée telle quelle : ce n'est pas le sujet ici,
-- et la toucher changerait le périmètre d'envoi.
--
-- Le correctif reprend exactement le pattern de
-- `create_relance_tasks_on_rdv_achat` (même migration 20260831130000), qui a
-- traité le même décalage pour les tâches de relance :
--   · RDV créé depuis le CRM  → confirmed = true dès l'INSERT, mail immédiat
--                               (comportement inchangé) ;
--   · RDV Amelia              → mail au passage à confirmed = true, déclenché
--                               par trg_confirm_events_on_client_column_change
--                               quand le client quitte la colonne Kanban 9.
--
-- La garde anti-doublon existante (fenêtre 2 minutes sur created_at) reste
-- pertinente pour l'INSERT et ne peut pas matcher sur la confirmation, qui
-- survient bien plus tard.
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

-- ─── Remplacement du trigger ─────────────────────────────────────────────────
-- `call_go_api_on_false` n'est connu que par un commentaire de la migration
-- 20260623130000, jamais par du DDL versionné : le trigger a été créé à la main
-- comme la colonne « a confirmer ». Un simple DROP ... IF EXISTS sur ce nom
-- supposé ne garantirait donc rien — si le nom réel diffère, l'ancien trigger
-- AFTER INSERT survivrait à côté du nouveau et le client recevrait deux mails.
--
-- On supprime donc TOUT trigger de Event_calendar rattaché à cette fonction,
-- quel que soit son nom, avant de recréer le nôtre. tgisinternal exclut les
-- triggers système (contraintes FK).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc  p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'Event_calendar'
      AND p.proname = 'function_call_go_api_on_new_event'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public."Event_calendar"', r.tgname);
    RAISE NOTICE 'Trigger % supprimé avant recréation', r.tgname;
  END LOOP;
END;
$$;

-- `UPDATE OF confirmed` plutôt qu'`UPDATE` nu : le trigger ne se réveille que
-- si la colonne figure dans le SET, au lieu de tourner sur chaque déplacement
-- de RDV dans l'agenda. La garde OLD/NEW ci-dessus reste nécessaire — mentionner
-- la colonne suffit à déclencher, même sans changement de valeur.
CREATE TRIGGER call_go_api_on_false
  AFTER INSERT OR UPDATE OF confirmed ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.function_call_go_api_on_new_event();
