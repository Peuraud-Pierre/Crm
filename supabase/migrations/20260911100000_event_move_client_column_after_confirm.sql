-- ============================================================
-- RDV Amelia : le client reste en « RDV à confirmer » jusqu'à la confirmation
-- ============================================================
-- Constat du 11/09/2026 : un RDV pris sur Amelia envoyait le client en
-- « RDV Decouverte » au lieu de « RDV à confirmer ». Le bridge écrit bien
-- collum = 9, mais l'INSERT du RDV passait ensuite par
-- set_event_customer_from_closer, qui range le client selon la nature du RDV
-- (achat → 4, découverte → 3) sans regarder `confirmed`. Le client quittant
-- la colonne 9 avant que le RDV soit écrit, trg_confirm_events_on_client_column_change
-- ne le trouvait pas : le RDV restait non confirmé, hors agenda, et n'était
-- plus confirmable depuis le Kanban.
--
-- Nouvelle règle : le client n'est rangé selon la nature du RDV qu'une fois
-- le RDV confirmé.
--   · RDV Amelia en attente → le client reste en colonne 9 ;
--   · bouton « Confirmer » → le client part selon la nature : achat → 4
--     « RDV Achat », découverte visio → 5 « Visio RDV » (auparavant 3),
--     découverte physique → 3 « RDV Decouverte » ;
--   · fiche glissée hors de la colonne 9 → la colonne choisie par le
--     commercial est respectée ;
--   · RDV créé depuis le CRM (confirmé d'office) → inchangé.
--
-- Le rangement passe d'un trigger BEFORE à un trigger AFTER. En BEFORE, le
-- bouton « Confirmer » échouerait : le passage 9 → 3 déclenche
-- trg_confirm_events_on_client_column_change, qui modifie la ligne encore en
-- cours de mise à jour (« tuple to be updated was already modified by an
-- operation triggered by the current command »).
-- ============================================================

-- 1. set_event_customer_from_closer ne gère plus que le commercial.
CREATE OR REPLACE FUNCTION public.set_event_customer_from_closer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
DECLARE
    v_closer_id uuid;
BEGIN
    -- Un commercial renseigné (choisi à la création, changé lors d'un
    -- transfert, ou simplement inchangé) est la source de vérité : on ne le
    -- remplace jamais. trg_sync_customer_to_closer (AFTER) aligne ensuite le
    -- closer de la fiche sur cette valeur.
    IF NEW.id_client IS NULL OR NEW.customer IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Pas de commercial (INSERT sans owner, ou UPDATE qui l'a vidé) :
    -- repli sur le closer de la fiche client.
    SELECT closers INTO v_closer_id
      FROM public.client_crm
     WHERE id = NEW.id_client;

    IF v_closer_id IS NOT NULL THEN
        NEW.customer := v_closer_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_event_customer_from_closer() IS
    'BEFORE INSERT/UPDATE Event_calendar : ne remplit `customer` depuis le '
    'closer de la fiche QUE s''il est vide. Un commercial choisi ou changé '
    'depuis le CRM est toujours respecté (cf. incident transfert du 10/09/2026). '
    'Le rangement Kanban est fait par move_client_column_on_event (AFTER).';

-- 2. Rangement Kanban selon la nature du RDV, une fois le RDV confirmé.
CREATE OR REPLACE FUNCTION public.move_client_column_on_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
DECLARE
    v_new_collum smallint;
BEGIN
    -- RDV en attente (Amelia) : le client reste en « RDV à confirmer ».
    IF NEW.id_client IS NULL OR NOT NEW.confirmed THEN
        RETURN NEW;
    END IF;

    IF NEW.nom ILIKE '%achat%' THEN
        v_new_collum := 4;
    ELSIF NEW.nom ILIKE '%visio%' THEN
        v_new_collum := 5;
    ELSIF NEW.nom ILIKE '%decouverte%' THEN
        v_new_collum := 3;
    ELSE
        RETURN NEW;
    END IF;

    UPDATE public.client_crm
       SET collum = v_new_collum
     WHERE id = NEW.id_client
       AND collum IS DISTINCT FROM v_new_collum
       -- À la confirmation, on ne range le client que s'il est encore en
       -- colonne 9 (bouton « Confirmer »). S'il en est déjà sorti, c'est que
       -- le commercial a confirmé en glissant sa fiche dans le Kanban : la
       -- colonne qu'il a choisie est respectée.
       AND (TG_OP = 'INSERT' OR OLD.confirmed OR collum = 9);

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.move_client_column_on_event() IS
    'AFTER INSERT/UPDATE Event_calendar : range le client dans la colonne '
    'Kanban de la nature du RDV (achat → 4, découverte visio → 5, découverte '
    'physique → 3), uniquement si le '
    'RDV est confirmé. Un RDV Amelia en attente laisse le client en colonne 9.';

DROP TRIGGER IF EXISTS trg_move_client_column_on_event ON public."Event_calendar";
CREATE TRIGGER trg_move_client_column_on_event
  AFTER INSERT OR UPDATE ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.move_client_column_on_event();

-- 3. Rattrapage : clients déplacés à tort alors que leur RDV Amelia à venir
--    attend encore sa confirmation → retour en « RDV à confirmer ».
UPDATE public.client_crm c
   SET collum = 9
 WHERE c.collum IN (3, 4)
   AND EXISTS (
         SELECT 1
           FROM public."Event_calendar" e
          WHERE e.id_client = c.id
            AND e.source = 'amelia'
            AND NOT e.confirmed
            AND e.debut >= now()
       );
