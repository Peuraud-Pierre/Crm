-- ============================================================
-- Notifications CRM — mise à jour des liens de redirection
--
-- Le routing CRM est passé des query-params (`/crm?tab=...`) à des segments
-- de chemin canoniques (cf. SinglePageCRM : SECTION_TO_TAB / TAB_TO_SECTION) :
--   customers → /crm/clients
--   Tache     → /crm/tache
--   calendar  → /crm/agenda/days   (l'agenda exige un segment de vue)
--
-- On régénère les trois fonctions de 20260617120000_crm_notifications.sql à
-- l'identique, en ne changeant QUE l'URL insérée dans public.notification,
-- pour que le clic sur une notif retombe bien sur la bonne page.
-- ============================================================


-- ─── 1. Nouveau lead/client → /crm/clients ────────────────────────────────────
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
            VALUES (v_uid::uuid, 'system', v_title, '/crm/clients');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;


-- ─── 2. Tâches en retard / pour aujourd'hui → /crm/tache ──────────────────────
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
            VALUES (r.owner, 'system', v_title, '/crm/tache');
        END IF;
    END LOOP;
END;
$$;


-- ─── 3. RDV dans ~1h → /crm/agenda/days ───────────────────────────────────────
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
            VALUES (v_user, 'system', v_title, '/crm/agenda/days');
        END IF;
    END LOOP;
END;
$$;


-- ─── 4. Rattrapage des notifications CRM déjà en base (liens `?tab=`) ─────────
-- Les notifs non encore lues qui pointent vers l'ancien format sont réécrites
-- vers les nouveaux chemins canoniques.
UPDATE public.notification SET url = '/crm/clients'      WHERE url = '/crm?tab=customers';
UPDATE public.notification SET url = '/crm/tache'        WHERE url = '/crm?tab=Tache';
UPDATE public.notification SET url = '/crm/agenda/days'  WHERE url = '/crm?tab=calendar';
