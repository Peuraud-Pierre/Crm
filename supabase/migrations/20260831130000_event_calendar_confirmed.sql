-- ============================================================
-- RDV Amelia en attente de confirmation
--
-- Un RDV pris par un prospect sur Amelia positionne son client en colonne
-- Kanban 9 « RDV à confirmer » (bridge Go, main.go). Jusqu'ici l'événement
-- apparaissait immédiatement dans l'agenda du commercial, alors même que le
-- RDV n'était pas validé.
--
-- `confirmed` sépare les deux : l'événement existe en base dès la prise (on
-- garde le brief, le rattachement client et l'historique), mais reste hors
-- agenda tant que le commercial n'a pas sorti le client de la colonne 9.
--
-- DEFAULT true : tout l'existant et tout ce que le CRM crée lui-même est
-- confirmé d'office. Seul le bridge Amelia insère `confirmed = false`, et
-- uniquement quand l'événement est rattaché à une fiche client — sans
-- `id_client`, personne ne pourrait le confirmer depuis le Kanban.
-- ============================================================

ALTER TABLE public."Event_calendar"
  ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public."Event_calendar".confirmed IS
    'false = RDV Amelia en attente de confirmation : exclu de l''agenda, du '
    'widget « RDV du jour » et de la détection de conflit de créneau. Passe à '
    'true quand le client quitte la colonne Kanban 9 vers une colonne RDV.';

-- Index partiel : les lectures filtrent quasi toutes sur confirmed = true,
-- les lignes en attente sont une poignée à la fois.
CREATE INDEX IF NOT EXISTS event_calendar_unconfirmed_idx
  ON public."Event_calendar" (id_client)
  WHERE confirmed = false;

-- ─── Confirmation depuis le Kanban ───────────────────────────────────────────
-- Colonnes cibles qui valident le RDV (cf. COLUMN_NAMES, shared/utils/CrmTab.ts) :
--   3 RDV Decouverte · 4 RDV Achat · 5 Visio RDV · 6 Fidélisation / Client Actif
-- Volontairement exclues : 7 Dormant, 8 No Show et tout retour en amont du
-- pipeline — le prospect n'a pas donné suite, le RDV n'a pas à rejoindre
-- l'agenda.
--
-- SECURITY DEFINER : le déplacement Kanban est fait par un commercial (rôle
-- `authenticated`) qui n'est pas forcément propriétaire de l'événement ; sans
-- élévation, l'UPDATE serait filtré par RLS et n'affecterait aucune ligne.
CREATE OR REPLACE FUNCTION public.confirm_events_on_client_column_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF old.collum IS DISTINCT FROM new.collum
     AND old.collum = 9
     AND new.collum IN (3, 4, 5, 6)
  THEN
    UPDATE public."Event_calendar"
    SET confirmed  = true,
        updated_at = now()
    WHERE id_client = new.id
      AND confirmed = false;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_confirm_events_on_client_column_change ON public.client_crm;

CREATE TRIGGER trg_confirm_events_on_client_column_change
  AFTER UPDATE OF collum ON public.client_crm
  FOR EACH ROW
  EXECUTE FUNCTION public.confirm_events_on_client_column_change();

-- ─── Tâches de relance : à la confirmation, plus à la création ────────────────
-- `create_relance_tasks_on_rdv_achat` (cf. 20260831120000) créait ses deux
-- tâches dès l'INSERT. Un RDV achat Amelia non confirmé générait donc un suivi
-- et une relance pour un rendez-vous encore incertain. Le trigger écoute
-- désormais aussi l'UPDATE et ne produit les tâches qu'une fois l'événement
-- confirmé — à l'insertion pour un RDV créé depuis le CRM (confirmed = true
-- d'office), au passage à true pour un RDV Amelia.
CREATE OR REPLACE FUNCTION public.create_relance_tasks_on_rdv_achat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF new.nom NOT IN ('rdv physique achat', 'rdv visio achat') THEN
    RETURN new;
  END IF;

  -- Rien tant que le RDV n'est pas confirmé.
  IF NOT new.confirmed THEN
    RETURN new;
  END IF;

  -- Sur UPDATE : uniquement au passage effectif à confirmed = true, sinon
  -- chaque modification du RDV redupliquerait les tâches.
  IF TG_OP = 'UPDATE' AND old.confirmed IS NOT DISTINCT FROM new.confirmed THEN
    RETURN new;
  END IF;

  v_owner := COALESCE(new.customer, new.creator_id);

  INSERT INTO public."Tache_crm" (type, client, content, date, owner, creator_id, categorie, event_id)
  VALUES
    ('Suivis rdv',         new.id_client, 'Suivi suite au RDV achat',    new.debut + interval '1 day',  v_owner, new.creator_id, 'crm', new.id),
    ('Relance post achat', new.id_client, 'Relance post achat (RDV)',    new.debut + interval '30 days', v_owner, new.creator_id, 'crm', new.id);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_relance_tasks_on_rdv_achat ON public."Event_calendar";

CREATE TRIGGER trg_create_relance_tasks_on_rdv_achat
  AFTER INSERT OR UPDATE ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.create_relance_tasks_on_rdv_achat();
