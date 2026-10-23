-- ============================================================
-- Event_calendar — confirmation marquée côté base
-- ============================================================
-- Jusqu'ici le front (`confirmCalendarEvent`) écrivait lui-même
-- `confirmed_by`, `creator_id` et `created_at` en confirmant un RDV. Trois
-- défauts :
--
-- 1. Confirmer depuis le Kanban (trg_confirm_events_on_client_column_change,
--    colonne 9 → 3..6) ne posait pas `confirmed_by` : le setter du client
--    devenait celui qui déplaçait la fiche (auth.uid() dans
--    set_client_setter_on_confirm), mais le RDV ne comptait pas dans ses
--    stats. Setter et stats divergeaient selon le chemin de confirmation.
-- 2. `confirmed_by` venait du client sans contrôle : tout utilisateur
--    crm.view pouvait s'attribuer (ou attribuer à un autre) un RDV dans les
--    stats, et faire écrire `client_crm.customer` par le trigger SECURITY
--    DEFINER, hors RLS de client_crm.
-- 3. La confirmation n'était pas idempotente : un second clic (fiche +
--    agenda, vue pas rafraîchie) réécrivait creator_id / created_at /
--    confirmed_by — le crédit passait au dernier, le setter restait au
--    premier.
--
-- Désormais un trigger BEFORE pose ces colonnes lui-même, UNIQUEMENT au
-- passage confirmed false → true, avec l'utilisateur authentifié
-- (auth.uid() — y compris sous le trigger Kanban SECURITY DEFINER, qui ne
-- change pas les claims JWT). Hors de ce passage, `confirmed_by` est figé à
-- sa valeur précédente. Le front n'envoie plus que `confirmed = true`.
--
-- Sans utilisateur authentifié (service_role : bridge Amelia, workers,
-- cron), rien n'est forcé : ces contextes sont de confiance.
--
-- Le setter reste écrit par trg_set_client_setter_on_confirm (AFTER), qui
-- lit NEW.confirmed_by — désormais toujours celui qui confirme.
--
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.stamp_event_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Un RDV créé dans le CRM compte déjà par sa source : `confirmed_by`
        -- ne marque que la confirmation d'un RDV existant.
        NEW.confirmed_by := NULL;
        RETURN NEW;
    END IF;

    IF NEW.confirmed IS TRUE AND OLD.confirmed IS DISTINCT FROM TRUE THEN
        -- Confirmer compte le RDV comme CRÉÉ par celui qui confirme, ce
        -- jour-là (voir 20260924110000_event_calendar_confirmed_by.sql).
        NEW.confirmed_by := v_uid;
        NEW.creator_id   := v_uid;
        NEW.created_at   := now();
    ELSE
        NEW.confirmed_by := OLD.confirmed_by;
        IF OLD.confirmed IS TRUE THEN
            -- Déjà confirmé : une confirmation répétée ne vole pas le crédit.
            NEW.creator_id := OLD.creator_id;
            NEW.created_at := OLD.created_at;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_event_confirmation ON public."Event_calendar";
CREATE TRIGGER trg_stamp_event_confirmation
    BEFORE INSERT OR UPDATE ON public."Event_calendar"
    FOR EACH ROW
    EXECUTE FUNCTION public.stamp_event_confirmation();
