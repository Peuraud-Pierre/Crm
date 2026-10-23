-- Ajout d'une 3e tâche de relance : "Relance confirmation" à J-2.
--
-- `create_relance_tasks_on_rdv_achat` (20260831120000, complétée par
-- 20260831130000 pour se déclencher aussi à la confirmation d'un RDV Amelia)
-- ne posait que deux tâches : suivi à J+1 et relance à J+30. On ajoute une
-- 3e tâche à J-2 (2 jours avant le RDV), pour que le commercial rappelle le
-- client et confirme sa présence avant le rendez-vous — même périmètre que
-- les deux tâches existantes (RDV achat uniquement), créée en même temps
-- qu'elles (à l'INSERT pour un RDV créé depuis le CRM, à la confirmation
-- pour un RDV Amelia).
--
-- CREATE OR REPLACE redéfinit entièrement la fonction (garde `confirmed`
-- incluse) plutôt qu'un simple ajout, par précaution : la version réellement
-- en base peut différer de celle du repo, comme constaté sur le trigger mail
-- (20260909130000).

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
    ('Relance confirmation', new.id_client, 'Relance confirmation de RDV', new.debut - interval '2 days',  v_owner, new.creator_id, 'crm', new.id),
    ('Suivis rdv',           new.id_client, 'Suivi suite au RDV achat',    new.debut + interval '1 day',   v_owner, new.creator_id, 'crm', new.id),
    ('Relance post achat',   new.id_client, 'Relance post achat (RDV)',    new.debut + interval '31 days', v_owner, new.creator_id, 'crm', new.id);

  RETURN new;
END;
$$;
