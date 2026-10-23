-- Notification immédiate quand un admin crée une tâche CRM assignée à
-- quelqu'un d'autre (champ "Assigner à" du formulaire de création de tâche,
-- src/features/crm/modales/TaskModals.tsx). Reprend le pattern déjà utilisé
-- pour les messages (notify_cryptedmessage, 20260630120000) : trigger
-- AFTER INSERT + garde sur le destinataire, insert dans public.notification
-- (déclenche aussi le push via le webhook existant, voir
-- 20260617120000_crm_notifications.sql pour la convention).
--
-- Le rôle "admin" du créateur est vérifié via public.user_is_global_admin(),
-- déjà défini dans 20250926114835_normalize_role_checks.sql.

CREATE OR REPLACE FUNCTION public.notify_crm_task_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_title TEXT;
BEGIN
    -- Pas de notif si la tâche n'est pas assignée, si le créateur se
    -- l'attribue à lui-même, ou si le créateur n'est pas admin.
    IF NEW.owner IS NULL
       OR NEW.owner = auth.uid()
       OR NOT public.user_is_global_admin(auth.uid())
    THEN
        RETURN NEW;
    END IF;

    v_title := 'Nouvelle tâche assignée : '
               || COALESCE(NULLIF(NEW.content, ''), NULLIF(NEW.type, ''), 'tâche');

    INSERT INTO public.notification (user_id, type, title, url)
    VALUES (NEW.owner, 'system', v_title, '/crm?tab=Tache');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_task_assigned_notify ON public."Tache_crm";
CREATE TRIGGER crm_task_assigned_notify
    AFTER INSERT ON public."Tache_crm"
    FOR EACH ROW EXECUTE FUNCTION public.notify_crm_task_assigned();
