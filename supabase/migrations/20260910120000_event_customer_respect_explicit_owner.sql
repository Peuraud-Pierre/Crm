-- ============================================================
-- Event_calendar : le commercial choisi dans le CRM doit être respecté
-- ============================================================
-- Constat du 10/09/2026 (incident « impossible de transférer un RDV de David
-- à Commercial C ») : le trigger trg_set_event_customer_from_closer, créé à la main et
-- jamais versionné, réécrit `customer` à CHAQUE INSERT/UPDATE avec le closer
-- de la fiche client. Le front écrivait bien `customer = Commercial C`, le trigger le
-- remplaçait par le closer courant (David) avant l'écriture : le transfert
-- était silencieusement annulé, sans erreur ni log. Même effet à la création
-- d'un RDV pour un client qui a déjà un closer.
--
-- Le trigger jumeau trg_sync_customer_to_closer (AFTER) fait la propagation
-- inverse (RDV → fiche). À eux deux, le closer de la fiche gagnait toujours :
-- aucun changement de commercial n'était possible depuis l'agenda.
--
-- Nouvelle règle, dans set_event_customer_from_closer :
--   · customer renseigné (création avec commercial, transfert, ou valeur
--     inchangée) → respecté tel quel ; le sync AFTER aligne la fiche ;
--   · customer NULL (création sans commercial, ou UPDATE qui l'a vidé) →
--     repli sur le closer de la fiche — c'est ce repli qui a rebouché les RDV
--     vidés par le bouton « Confirmer » du 09/09.
-- Le déplacement Kanban (colonne 3/4 selon la nature) est conservé tel quel.
--
-- On en profite pour versionner les fonctions voisines telles qu'elles sont en
-- base (sync_customer_to_closer, update_event_calendar_updated_at,
-- set_confirmation_amelia) afin que le dépôt reflète enfin l'état réel.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_event_customer_from_closer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
DECLARE
    v_closer_id  uuid;
    v_new_collum smallint := NULL;
BEGIN
    IF NEW.id_client IS NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Nature du RDV → colonne Kanban du client (comportement historique).
    IF NEW.nom ILIKE '%achat%' THEN
        v_new_collum := 4;
    ELSIF NEW.nom ILIKE '%decouverte%' THEN
        v_new_collum := 3;
    END IF;

    IF v_new_collum IS NOT NULL THEN
        UPDATE public.client_crm
           SET collum = v_new_collum
         WHERE id = NEW.id_client
           AND collum IS DISTINCT FROM v_new_collum;
    END IF;

    -- 2. Un commercial renseigné (choisi à la création, changé lors d'un
    --    transfert, ou simplement inchangé) est la source de vérité : on ne le
    --    remplace jamais. trg_sync_customer_to_closer (AFTER) aligne ensuite le
    --    closer de la fiche sur cette valeur.
    IF NEW.customer IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- 3. Pas de commercial (INSERT sans owner, ou UPDATE qui l'a vidé) :
    --    repli sur le closer de la fiche client.
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
    'BEFORE INSERT/UPDATE Event_calendar : déplace le client dans la colonne '
    'Kanban correspondant à la nature du RDV, et ne remplit `customer` depuis '
    'le closer de la fiche QUE s''il est vide. Un commercial choisi ou changé '
    'depuis le CRM est toujours respecté (cf. incident transfert du 10/09/2026).';

DROP TRIGGER IF EXISTS trg_set_event_customer_from_closer ON public."Event_calendar";
CREATE TRIGGER trg_set_event_customer_from_closer
  BEFORE INSERT OR UPDATE ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_event_customer_from_closer();

-- ─── Fonctions voisines, versionnées à l'identique de la base ────────────────

-- RDV → fiche : le commercial du RDV devient le closer du client.
CREATE OR REPLACE FUNCTION public.sync_customer_to_closer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NEW.id_client IS NOT NULL AND NEW.customer IS NOT NULL THEN
    UPDATE public.client_crm
       SET closers = NEW.customer
     WHERE id = NEW.id_client
       AND closers IS DISTINCT FROM NEW.customer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_to_closer ON public."Event_calendar";
CREATE TRIGGER trg_sync_customer_to_closer
  AFTER INSERT OR UPDATE ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_to_closer();

-- updated_at maintenu par trigger (le front n'a pas besoin de l'écrire, mais
-- peut le faire sans effet de bord).
CREATE OR REPLACE FUNCTION public.update_event_calendar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_event_calendar_updated_at ON public."Event_calendar";
CREATE TRIGGER trigger_event_calendar_updated_at
  BEFORE UPDATE ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_calendar_updated_at();

-- Trigger historique, aujourd'hui sans effet : il compare `source` à 'Amelia'
-- alors que le bridge écrit 'amelia', et il n'écrit que la colonne legacy
-- « a confirmer » (remplacée par `confirmed`, cf. 20260831130000). Versionné
-- tel quel pour refléter la base ; à supprimer dans une migration dédiée une
-- fois la colonne « a confirmer » retirée.
CREATE OR REPLACE FUNCTION public.set_confirmation_amelia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
BEGIN
    IF NEW.source = 'Amelia' THEN
        NEW."a confirmer" = true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_amelia_source ON public."Event_calendar";
CREATE TRIGGER trg_check_amelia_source
  BEFORE INSERT ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_confirmation_amelia();

-- ─── Policy UPDATE : même rôle que les trois autres ──────────────────────────
-- crm_event_update était posée sur `public` alors que select/insert/delete
-- sont sur `authenticated`. Même condition (has_permission('crm.view')),
-- rôle harmonisé.
DROP POLICY IF EXISTS crm_event_update ON public."Event_calendar";
CREATE POLICY crm_event_update ON public."Event_calendar"
  FOR UPDATE TO authenticated
  USING (public.has_permission('crm.view'))
  WITH CHECK (public.has_permission('crm.view'));

-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   -- transférer un RDV lié à un client vers un autre commercial :
--   UPDATE public."Event_calendar" SET customer = '<commercial_c>' WHERE id = '<rdv>';
--   SELECT customer FROM public."Event_calendar" WHERE id = '<rdv>';   -- commercial_c
--   SELECT closers  FROM public.client_crm WHERE id = '<client>';     -- commercial_c
--   -- vider le commercial : il est rebouché depuis le closer
--   UPDATE public."Event_calendar" SET customer = NULL WHERE id = '<rdv>';
--   SELECT customer FROM public."Event_calendar" WHERE id = '<rdv>';   -- commercial_c
