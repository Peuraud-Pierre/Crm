-- ============================================================
-- Auto-statut arrivage_manuel : transitions pilotées par le temps
-- Date: 2026-07-07
--
-- Bug corrigé : le trigger auto_set_arrivage_status (20260602) est un
-- BEFORE INSERT OR UPDATE — il ne s'évalue que quand la ligne est
-- écrite. Le passage en_transit → reçu dépend uniquement du temps
-- (prev_dechargement_at < NOW()) : une ligne que personne n'édite
-- n'était jamais réévaluée et restait bloquée en_transit.
--
-- Cette migration :
--   1. corrige le trigger : transitions chaînées (une ligne 'planifié'
--      dont les deux dates sont passées atteint 'reçu' en une seule
--      écriture, au lieu d'exiger deux éditions successives) ;
--   2. crée apply_arrivage_status_transitions() : scan set-based qui
--      applique les mêmes transitions à toute la table ;
--   3. la planifie toutes les heures via pg_cron (pattern identique à
--      20260617_crm_notifications.sql) et l'exécute immédiatement pour
--      rattraper les lignes actuellement bloquées.
--
-- Sémantique conservée : la date fait foi, y compris pour un statut
-- saisi manuellement (status_auto = FALSE). Pour maintenir un conteneur
-- retardé en 'en_transit', mettre à jour prev_dechargement_at.
--
-- NB : les UPDATE du scan déclenchent le Database Webhook arrivage_manuel
-- → la newsletter (debounce 20 min) peut partir suite à une bascule
-- automatique de statut. C'est voulu : un changement de statut est une
-- information pour les abonnés. Le trigger AFTER de rappel facture n'est
-- pas impacté (conditions non remplies pour une date passée, et
-- auth.uid() est NULL sous pg_cron → early return).
-- ============================================================

-- ─── 1. Trigger : transitions chaînées ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_set_arrivage_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Planifié → en_transit : date de départ passée
    IF NEW.departure_date IS NOT NULL
       AND NEW.departure_date < CURRENT_DATE
       AND NEW.status = 'planifié'
    THEN
        NEW.status      := 'en_transit';
        NEW.status_auto := TRUE;
    END IF;

    -- En transit → reçu : date de déchargement prévue passée.
    -- Pas de RETURN entre les deux blocs : les transitions se chaînent
    -- dans la même écriture.
    IF NEW.prev_dechargement_at IS NOT NULL
       AND NEW.prev_dechargement_at < NOW()
       AND NEW.status = 'en_transit'
    THEN
        NEW.status      := 'reçu';
        NEW.status_auto := TRUE;
    END IF;

    RETURN NEW;
END;
$$;

-- ─── 2. Scan périodique ──────────────────────────────────────────────────────
-- Ordre volontaire : planifié → en_transit d'abord, pour qu'une ligne
-- très en retard atteigne 'reçu' dans le même passage via le 2e UPDATE.

CREATE OR REPLACE FUNCTION public.apply_arrivage_status_transitions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.arrivage_manuel
    SET status = 'en_transit', status_auto = TRUE
    WHERE status = 'planifié'
      AND departure_date IS NOT NULL
      AND departure_date < CURRENT_DATE;

    UPDATE public.arrivage_manuel
    SET status = 'reçu', status_auto = TRUE
    WHERE status = 'en_transit'
      AND prev_dechargement_at IS NOT NULL
      AND prev_dechargement_at < NOW();
END;
$$;

-- ─── 3. Rattrapage immédiat des lignes bloquées ──────────────────────────────

SELECT public.apply_arrivage_status_transitions();

-- ─── 4. Planification pg_cron (toutes les heures, minute 5) ─────────────────
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
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arrivage-status-auto') THEN
            PERFORM cron.unschedule('arrivage-status-auto');
        END IF;
        PERFORM cron.schedule(
            'arrivage-status-auto',
            '5 * * * *',
            $cmd$ SELECT public.apply_arrivage_status_transitions(); $cmd$
        );
    END IF;
END $$;
