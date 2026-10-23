-- ============================================================
-- Notifications CRM
--
-- 1. Nouveau lead   → notification immédiate au service « Commercial »
--                     (trigger AFTER INSERT sur public.client_crm)
-- 2. Tâches en retard / pour aujourd'hui → notification au propriétaire
--                     (fonction de scan quotidienne)
-- 3. RDV dans ~1h   → notification à la personne assignée
--                     (fonction de scan toutes les ~10 min)
--
-- Conventions reprises de 20260602_arrivage_invoice_reminder.sql :
--   - INSERT dans public.notification(user_id, type, title, url)
--   - dédup via NOT EXISTS (même titre + fenêtre temporelle)
--   - ciblage service = user_id de la notification = services.id
--     (le front s'abonne au realtime sur user_id ET service_id)
--   - planification pg_cron gardée (cf. 20260610120000_app_logs_retention.sql)
-- ============================================================


-- ─── 1. Nouveau lead/client → liste fixe de collaborateurs ────────────────────
-- Déclenché sur public.client_crm : un nouveau lead « arrive dans le CRM » quand
-- une ligne client_crm est créée (le sync depuis `leads` fait un UPSERT, donc un
-- lead récurrent met à jour la fiche existante et ne re-notifie pas).
-- Une notif PAR destinataire (le front ne re-fetche que les notifs où
-- user_id = son user_id), dédupliquée sur 24h.
CREATE OR REPLACE FUNCTION public.notify_crm_new_lead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_title TEXT;
    v_uid   TEXT;
    v_ids   TEXT[] := ARRAY[
        '8f93efc7-a3fb-496b-a397-781ae3fc41cf',
        'f2166860-c501-4c35-926c-fc8fb097eff5',
        '921e5a2d-1447-4f4c-b893-2f935a996973',
        '998e6ec9-1a2b-4c84-ac36-e0deedb43f52',
        '2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade',
        '77f6427e-3658-47e7-80ce-d40eb31a5d8e'
    ];
BEGIN
    v_title := 'Nouveau lead : ' || COALESCE(NULLIF(NEW.nom, ''), NEW.mail, 'sans nom');

    FOREACH v_uid IN ARRAY v_ids LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.notification n
            WHERE n.user_id = v_uid::uuid
              AND n.title = v_title
              AND n.created_at > NOW() - INTERVAL '24 hours'
        ) THEN
            INSERT INTO public.notification (user_id, type, title, url)
            VALUES (v_uid::uuid, 'system', v_title, '/crm?tab=customers');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Nettoyage : ancienne version qui écoutait la table `leads`.
DROP TRIGGER IF EXISTS crm_new_lead_notify ON public.leads;

DROP TRIGGER IF EXISTS crm_new_lead_notify ON public.client_crm;
CREATE TRIGGER crm_new_lead_notify
    AFTER INSERT ON public.client_crm
    FOR EACH ROW EXECUTE FUNCTION public.notify_crm_new_lead();


-- ─── 2. Tâches en retard / pour aujourd'hui → propriétaire ────────────────────
-- À appeler chaque matin (pg_cron ou backend Go).
CREATE OR REPLACE FUNCTION public.notify_crm_task_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r       RECORD;
    v_title TEXT;
BEGIN
    FOR r IN
        SELECT t.id, t.owner, t.date, t.type, t.content,
               (t.date::date < CURRENT_DATE) AS is_overdue
        FROM public."Tache_crm" t
        WHERE t.owner IS NOT NULL
          AND t.date IS NOT NULL
          AND t.valide IS NOT TRUE
          AND t.date::date <= CURRENT_DATE
    LOOP
        v_title := CASE WHEN r.is_overdue THEN 'Tâche en retard : ' ELSE 'Tâche aujourd''hui : ' END
                   || COALESCE(NULLIF(r.content, ''), NULLIF(r.type, ''), 'tâche');

        IF NOT EXISTS (
            SELECT 1 FROM public.notification
            WHERE user_id = r.owner
              AND title = v_title
              AND created_at > NOW() - INTERVAL '23 hours'
        ) THEN
            INSERT INTO public.notification(user_id, type, title, url)
            VALUES (r.owner, 'system', v_title, '/crm?tab=Tache');
        END IF;
    END LOOP;
END;
$$;


-- ─── 3. RDV dans ~1h → personne assignée ──────────────────────────────────────
-- À appeler toutes les ~10 min (pg_cron ou backend Go). On notifie une seule fois
-- par RDV : dès qu'il entre dans la fenêtre « commence dans ≤ 60 min ».
CREATE OR REPLACE FUNCTION public.notify_crm_rdv_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r       RECORD;
    v_user  UUID;
    v_title TEXT;
BEGIN
    FOR r IN
        SELECT id, nom, debut, customer, creator_id
        FROM public."Event_calendar"
        WHERE debut IS NOT NULL
          AND debut > NOW()
          AND debut <= NOW() + INTERVAL '60 minutes'
          AND COALESCE(show, true) = true
    LOOP
        v_user := COALESCE(r.customer, r.creator_id);
        IF v_user IS NULL THEN CONTINUE; END IF;

        v_title := 'RDV dans 1h : ' || COALESCE(NULLIF(r.nom, ''), 'Rendez-vous')
                   || ' (' || to_char(r.debut AT TIME ZONE 'Europe/Paris', 'HH24:MI') || ')';

        -- Dédup : un seul rappel par RDV (fenêtre = autour de l'heure de début).
        IF NOT EXISTS (
            SELECT 1 FROM public.notification
            WHERE user_id = v_user
              AND title = v_title
              AND created_at > NOW() - INTERVAL '90 minutes'
        ) THEN
            INSERT INTO public.notification(user_id, type, title, url)
            VALUES (v_user, 'system', v_title, '/crm?tab=calendar');
        END IF;
    END LOOP;
END;
$$;


-- ─── 4. Planification pg_cron (gardée) ────────────────────────────────────────
-- Repli possible : appeler les fonctions de scan depuis le backend Go.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_cron;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron non installable ici (%).', SQLERRM;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Tâches en retard / du jour : tous les matins à 07:00 UTC.
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-task-reminders') THEN
            PERFORM cron.unschedule('crm-task-reminders');
        END IF;
        PERFORM cron.schedule(
            'crm-task-reminders',
            '0 7 * * *',
            $cmd$ SELECT public.notify_crm_task_reminders(); $cmd$
        );

        -- RDV dans 1h : toutes les 10 minutes.
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-rdv-reminders') THEN
            PERFORM cron.unschedule('crm-rdv-reminders');
        END IF;
        PERFORM cron.schedule(
            'crm-rdv-reminders',
            '*/10 * * * *',
            $cmd$ SELECT public.notify_crm_rdv_reminders(); $cmd$
        );
    END IF;
END $$;
