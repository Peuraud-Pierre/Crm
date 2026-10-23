-- ============================================================
-- Deep-link notifications arrivage : /stock/arrivage/{id}
-- Date: 2026-07-17
--
-- Le routing stock devient /stock/:section?/:detail? (voir docs/ROUTING.md).
-- Les notifications arrivage pointaient toutes vers '/stock' (liste
-- générique) : elles pointent désormais vers le conteneur précis pour
-- ouvrir directement sa sheet d'édition depuis la notification.
--
-- Trois fonctions corrigées (CREATE OR REPLACE, corps inchangé à part
-- l'url de la notification) :
--   1. check_arrivage_invoice_reminder() — trigger AFTER INSERT/UPDATE,
--      notification immédiate (20260602_arrivage_invoice_reminder.sql)
--   2. notify_arrivage_invoice_reminders() — scan pg_cron quotidien,
--      version active (20260707150000_arrivage_invoice_reminder_cron.sql)
--   3. log_arrivage_activity() — trigger create/update/delete, version
--      active (20260601_activity_log_full_changes.sql). Le DELETE pointe
--      vers la liste (/stock/arrivage) : la ligne n'existe plus, éditer
--      un id supprimé n'a pas de sens.
-- ============================================================

-- ─── 1. Rappel facture — notification immédiate à l'écriture ─────────────────

CREATE OR REPLACE FUNCTION public.check_arrivage_invoice_reminder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_service_id UUID;
    v_title      TEXT;
BEGIN
    IF NEW.prev_dechargement_at IS NULL                       THEN RETURN NEW; END IF;
    IF NEW.prev_dechargement_at <= NOW()                      THEN RETURN NEW; END IF;
    IF NEW.prev_dechargement_at > NOW() + INTERVAL '7 days'  THEN RETURN NEW; END IF;
    IF NEW.invoice_date IS NOT NULL                           THEN RETURN NEW; END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.prev_dechargement_at IS NOT DISTINCT FROM NEW.prev_dechargement_at
       AND OLD.invoice_date IS NOT DISTINCT FROM NEW.invoice_date
    THEN RETURN NEW; END IF;

    SELECT service_id INTO v_service_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    IF v_service_id IS NULL THEN RETURN NEW; END IF;

    v_title := 'Facture manquante J-7 : ' || NEW.container_no;

    IF NOT EXISTS (
        SELECT 1 FROM public.notification
        WHERE user_id = v_service_id
          AND title = v_title
          AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
        INSERT INTO public.notification(user_id, type, title, url)
        VALUES (v_service_id, 'system', v_title, '/stock/arrivage/' || NEW.id);
    END IF;

    RETURN NEW;
END;
$$;

-- ─── 2. Rappel facture — scan pg_cron quotidien ──────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_arrivage_invoice_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r         RECORD;
    v_service RECORD;
    v_title   TEXT;
BEGIN
    FOR r IN
        SELECT id, container_no
        FROM public.arrivage_manuel
        WHERE prev_dechargement_at IS NOT NULL
          AND prev_dechargement_at > NOW()
          AND prev_dechargement_at <= NOW() + INTERVAL '7 days'
          AND invoice_date IS NULL
    LOOP
        v_title := 'Facture manquante J-7 : ' || r.container_no;

        FOR v_service IN
            SELECT DISTINCT pr.service_id
            FROM public.profiles pr
            WHERE pr.service_id IS NOT NULL
              AND public.user_has_permission(pr.user_id, 'stock.arrivage.view')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.notification
                WHERE user_id = v_service.service_id
                  AND title = v_title
                  AND created_at > NOW() - INTERVAL '23 hours'
            ) THEN
                INSERT INTO public.notification(user_id, type, title, url)
                VALUES (v_service.service_id, 'system', v_title, '/stock/arrivage/' || r.id);
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- ─── 3. Journal d'activité arrivage ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_arrivage_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_service_id UUID;
    v_label      TEXT;
    v_desc       TEXT;
    v_action     TEXT;
    v_url        TEXT;
BEGIN
    SELECT service_id INTO v_service_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

    IF TG_OP = 'INSERT' THEN
        v_label  := NEW.container_no;
        v_desc   := 'Arrivage créé : ' || NEW.container_no;
        v_action := 'create';
        v_url    := '/stock/arrivage/' || NEW.id;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'arrivage', NEW.id::TEXT, v_label, v_action, v_desc,
                jsonb_build_object(
                    'status',         NEW.status,
                    'transport_mode', NEW.transport_mode,
                    'fournisseur_id', NEW.fournisseur_id,
                    'departure_date', NEW.departure_date
                ));

    ELSIF TG_OP = 'UPDATE' THEN
        v_label  := NEW.container_no;
        v_action := 'update';
        v_url    := '/stock/arrivage/' || NEW.id;
        v_desc   := CASE
            WHEN OLD.status IS DISTINCT FROM NEW.status
            THEN 'Statut modifié : ' || NEW.container_no
                 || ' (' || COALESCE(OLD.status, '?') || ' → ' || NEW.status || ')'
            ELSE 'Arrivage mis à jour : ' || NEW.container_no
        END;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'arrivage', NEW.id::TEXT, v_label, v_action, v_desc,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));

    ELSIF TG_OP = 'DELETE' THEN
        v_label  := OLD.container_no;
        v_action := 'delete';
        -- La ligne n'existe plus : pointer vers la liste, pas vers un id mort.
        v_url    := '/stock/arrivage';
        v_desc   := 'Arrivage supprimé : ' || OLD.container_no;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'arrivage', OLD.id::TEXT, v_label, v_action, v_desc,
                jsonb_build_object(
                    'container_no',   OLD.container_no,
                    'status',         OLD.status,
                    'transport_mode', OLD.transport_mode,
                    'fournisseur_id', OLD.fournisseur_id,
                    'departure_date', OLD.departure_date
                ));
    END IF;

    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.notification(user_id, type, title, url)
        VALUES (v_service_id, 'system', v_desc, v_url);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
