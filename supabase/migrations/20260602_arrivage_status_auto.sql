-- ============================================================
-- Auto-statut arrivage_manuel
--
-- 1. Ajoute status_auto (booléen) : TRUE quand le statut a été
--    calculé automatiquement, FALSE quand confirmé/saisi manuellement.
-- 2. Migre les lignes déchargé → reçu (statuts fusionnés).
-- 3. Trigger BEFORE INSERT OR UPDATE : passe planifié → en_transit
--    dès que departure_date est passée.
-- ============================================================

-- ─── Colonne status_auto ─────────────────────────────────────────────────────

ALTER TABLE public.arrivage_manuel
    ADD COLUMN IF NOT EXISTS status_auto BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Migration déchargé → reçu ───────────────────────────────────────────────

UPDATE public.arrivage_manuel
SET status = 'reçu'
WHERE status = 'déchargé';

-- ─── Trigger BEFORE : auto en_transit ────────────────────────────────────────

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
        RETURN NEW;
    END IF;

    -- En transit → reçu : date de déchargement prévue passée
    IF NEW.prev_dechargement_at IS NOT NULL
       AND NEW.prev_dechargement_at < NOW()
       AND NEW.status = 'en_transit'
    THEN
        NEW.status      := 'reçu';
        NEW.status_auto := TRUE;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrivage_status_auto_trigger ON public.arrivage_manuel;
CREATE TRIGGER arrivage_status_auto_trigger
    BEFORE INSERT OR UPDATE ON public.arrivage_manuel
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_arrivage_status();
