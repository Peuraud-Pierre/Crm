-- ============================================================
-- Rappel facture arrivage : notification J-7 avant déchargement
--
-- Notifie quand prev_dechargement_at ≤ 7 jours et invoice_date est vide.
--
-- 1. Trigger AFTER INSERT OR UPDATE → notification immédiate
--    si la condition est remplie lors de la sauvegarde
-- 2. Fonction notify_arrivage_invoice_reminders() → appeler quotidiennement
--    via pg_cron ou le backend Go (pattern identique à Tache_crm)
-- ============================================================


-- ─── Trigger function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_arrivage_invoice_reminder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_service_id UUID;
    v_title      TEXT;
BEGIN
    -- Condition : dechargement futur dans ≤ 7 jours et date facture manquante
    IF NEW.prev_dechargement_at IS NULL                       THEN RETURN NEW; END IF;
    IF NEW.prev_dechargement_at <= NOW()                      THEN RETURN NEW; END IF;
    IF NEW.prev_dechargement_at > NOW() + INTERVAL '7 days'  THEN RETURN NEW; END IF;
    IF NEW.invoice_date IS NOT NULL                           THEN RETURN NEW; END IF;

    -- Sur UPDATE : ne notifie que si prev_dechargement_at ou invoice_date a changé
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
        VALUES (v_service_id, 'system', v_title, '/stock');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrivage_invoice_reminder_trigger ON public.arrivage_manuel;
CREATE TRIGGER arrivage_invoice_reminder_trigger
    AFTER INSERT OR UPDATE ON public.arrivage_manuel
    FOR EACH ROW EXECUTE FUNCTION public.check_arrivage_invoice_reminder();


-- ─── Fonction de scan quotidien ───────────────────────────────────────────────
-- Notifie uniquement les services dont au moins un membre possède la permission
-- stock.view (permission effective sur arrivage_manuel).
--
-- À appeler quotidiennement via pg_cron ou le backend Go :
--   SELECT cron.schedule('arrivage-invoice-reminder', '0 8 * * *',
--     $$ SELECT public.notify_arrivage_invoice_reminders(); $$);

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

        -- Services dont un membre a la permission stock.view sur arrivages
        FOR v_service IN
            SELECT DISTINCT pr.service_id
            FROM public.profiles pr
            WHERE pr.service_id IS NOT NULL
              AND public.user_has_permission(pr.user_id, 'stock.view')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.notification
                WHERE user_id = v_service.service_id
                  AND title = v_title
                  AND created_at > NOW() - INTERVAL '23 hours'
            ) THEN
                INSERT INTO public.notification(user_id, type, title, url)
                VALUES (v_service.service_id, 'system', v_title, '/stock');
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
