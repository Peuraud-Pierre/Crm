-- ============================================================
-- Rappel facture arrivage : planification pg_cron manquante
-- Date: 2026-07-07
--
-- La migration 20260602_arrivage_invoice_reminder.sql a créé la
-- fonction de scan quotidien notify_arrivage_invoice_reminders()
-- (« Facture manquante J-7 ») mais son cron.schedule n'était qu'en
-- commentaire — contrairement aux migrations CRM/logs qui planifient
-- réellement. Résultat : les notifications J-7 ne partaient que via
-- le trigger AFTER, c.-à-d. seulement si quelqu'un éditait la ligne
-- au bon moment.
--
-- Cette migration :
--   1. met à jour le filtre de destinataires du scan : la permission
--      effective de lecture sur arrivage_manuel est désormais
--      'stock.arrivage.view' (RLS 20260707130000), plus 'stock.view' ;
--   2. planifie le scan quotidiennement à 08:00 UTC, comme prévu par
--      le commentaire d'origine (pattern pg_cron conditionnel identique
--      à 20260617_crm_notifications.sql).
--
-- La dédup existante (fenêtre 23 h sur notification.title) borne le
-- rythme à une notification par jour et par conteneur concerné.
-- ============================================================

-- ─── 1. Scan : destinataires alignés sur la permission de lecture ────────────

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

        -- Services dont un membre peut lire arrivage_manuel
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
                VALUES (v_service.service_id, 'system', v_title, '/stock');
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- ─── 2. Planification pg_cron (quotidien, 08:00 UTC) ─────────────────────────
-- Repli possible : appeler la fonction depuis le backend Go.
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
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arrivage-invoice-reminder') THEN
            PERFORM cron.unschedule('arrivage-invoice-reminder');
        END IF;
        PERFORM cron.schedule(
            'arrivage-invoice-reminder',
            '0 8 * * *',
            $cmd$ SELECT public.notify_arrivage_invoice_reminders(); $cmd$
        );
    END IF;
END $$;
