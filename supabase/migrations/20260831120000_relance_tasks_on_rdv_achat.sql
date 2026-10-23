-- ============================================================
-- Tâches de relance automatiques sur les RDV achat
--
-- Ces deux fonctions et leurs triggers existaient UNIQUEMENT en base
-- (créés à la main dans Supabase Studio, jamais versionnés). Ce fichier
-- les remet sous contrôle de version tels qu'ils tournent en production.
--
-- Pourquoi maintenant : `create_relance_tasks_on_rdv_achat` insère
-- `Tache_crm.creator_id`, colonne ajoutée par la migration
-- 20260824120000_tache_crm_creator_id.sql. Cette migration n'ayant pas été
-- appliquée sur la base du bridge Amelia, tout RDV « achat » entrant y
-- échouait en 42703 (« column creator_id of relation Tache_crm does not
-- exist ») : l'INSERT dans Event_calendar était annulé, le RDV existait
-- côté Amelia mais jamais dans le CRM. Versionner les triggers évite qu'une
-- fonction en base référence à nouveau une colonne qu'aucune migration
-- n'a créée.
--
-- DÉPENDANCE : 20260824120000_tache_crm_creator_id.sql doit être appliquée
-- avant ce fichier (ordre chronologique des migrations).
-- ============================================================

-- ─── Création des tâches à la prise d'un RDV achat ───────────────────────────
-- Deux tâches par RDV : un suivi à J+1 et une relance à J+30. `owner` (à qui
-- la tâche revient) retombe sur le créateur quand le RDV n'a pas de commercial
-- assigné — cas d'un RDV Amelia dont le provider n'est pas mappé vers un user
-- Supabase, qui produit alors des tâches sans owner.
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
  AFTER INSERT ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.create_relance_tasks_on_rdv_achat();

-- ─── Suivi des tâches quand le RDV bouge ─────────────────────────────────────
-- No-show : les tâches n'ont plus lieu d'être, on les supprime (terminées ou
-- non). RDV déplacé : on recale les échéances sur la nouvelle date, sans
-- toucher aux tâches déjà validées.
CREATE OR REPLACE FUNCTION public.sync_relance_tasks_on_rdv_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.nom NOT IN ('rdv physique achat', 'rdv visio achat') THEN
    RETURN new;
  END IF;

  -- No-show : on supprime les tâches, terminées ou non.
  IF old.show IS DISTINCT FROM new.show AND new.show = false THEN
    DELETE FROM public."Tache_crm"
    WHERE event_id = new.id
      AND type IN ('Suivis rdv', 'Relance post achat');
    RETURN new;
  END IF;

  -- RDV déplacé : on recale les dates des tâches non terminées
  -- en fonction de la nouvelle date du RDV (new.debut).
  IF new.debut IS DISTINCT FROM old.debut THEN
    UPDATE public."Tache_crm"
    SET date = new.debut + interval '1 day'
    WHERE event_id = new.id
      AND type = 'Suivis rdv'
      AND COALESCE(valide, false) = false;

    UPDATE public."Tache_crm"
    SET date = new.debut + interval '30 days'
    WHERE event_id = new.id
      AND type = 'Relance post achat'
      AND COALESCE(valide, false) = false;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_relance_tasks_on_rdv_update ON public."Event_calendar";

CREATE TRIGGER trg_sync_relance_tasks_on_rdv_update
  AFTER UPDATE ON public."Event_calendar"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_relance_tasks_on_rdv_update();
