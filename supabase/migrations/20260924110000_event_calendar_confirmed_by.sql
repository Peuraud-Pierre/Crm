-- ============================================================
-- Event_calendar.confirmed_by — qui a confirmé un RDV Amelia
-- ============================================================
-- Confirmer un RDV Amelia en attente le compte désormais comme CRÉÉ par
-- celui qui confirme, le jour de la confirmation : le front
-- (`confirmCalendarEvent`) réécrit `creator_id` et `created_at`, et pose
-- `confirmed_by`. Cette colonne est le marqueur qui fait entrer ces RDV
-- (source 'amelia') dans les stats de prise de RDV, réservées jusque-là à
-- `source = 'crm'` — voir src/features/crm/utils/statsEligibility.ts.
--
-- L'ancien `created_at` (prise sur Amelia) reste lisible dans le journal
-- `log_changes` (trigger trg_log_change_callendar).
--
-- `get_crm_event_stats` renvoie `SETOF "Event_calendar"` : la colonne y
-- apparaît sans modifier la fonction.
--
-- Idempotent.
-- ============================================================

ALTER TABLE public."Event_calendar"
    ADD COLUMN IF NOT EXISTS confirmed_by uuid NULL
        REFERENCES public.profiles (user_id);

COMMENT ON COLUMN public."Event_calendar".confirmed_by IS
    'Utilisateur CRM qui a confirmé ce RDV (Amelia). Non nul : le RDV compte dans les stats comme créé par lui, à la date de confirmation.';

-- ------------------------------------------------------------
-- Setter du client = celui qui confirme le RDV
-- ------------------------------------------------------------
-- Le setter d'un client est `client_crm.customer` (colonne « Setters » du
-- CRM). Il était écrit par le front après la confirmation, mais la RLS de
-- client_crm faisait échouer l'écriture EN SILENCE (0 ligne, pas d'erreur)
-- pour un setter qui n'a pas la main sur la fiche. Un trigger SECURITY
-- DEFINER l'écrit désormais côté base, au passage confirmed false → true.
--
-- Setter = `confirmed_by` (posé par le front), à défaut l'utilisateur
-- connecté (`auth.uid()`). Rien n'est écrit sans client rattaché.

CREATE OR REPLACE FUNCTION public.set_client_setter_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
DECLARE
    v_setter uuid := COALESCE(NEW.confirmed_by, auth.uid());
BEGIN
    IF NEW.id_client IS NOT NULL
       AND v_setter IS NOT NULL
       AND NEW.confirmed IS TRUE
       AND OLD.confirmed IS DISTINCT FROM TRUE THEN
        UPDATE public.client_crm
           SET customer = v_setter
         WHERE id = NEW.id_client
           AND customer IS DISTINCT FROM v_setter;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_setter_on_confirm ON public."Event_calendar";
CREATE TRIGGER trg_set_client_setter_on_confirm
    AFTER UPDATE OF confirmed ON public."Event_calendar"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_client_setter_on_confirm();
