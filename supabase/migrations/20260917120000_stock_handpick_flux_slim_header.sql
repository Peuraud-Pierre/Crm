-- ============================================================
-- Stock Handpick — en-tête de flux réduit
-- Date: 2026-09-17
-- Dépend de : 20260914154000 (dernière définition de v_flux_handpick)
--
-- `flux_handpick` ne porte plus que : direction, statut, fournisseur,
-- départ, déchargement prévu, notes. Colonnes retirées :
--   container_no, conteneur_no_raw, transport_mode, port_arrival_date,
--   invoice_no, invoice_date, reference_externe, status_auto.
--
-- `auto_set_flux_handpick_status` et
-- `apply_flux_handpick_status_transitions` écrivaient `status_auto` :
-- sans réécriture, toute transition automatique (départ passé,
-- déchargement passé) fait échouer l'écriture.
--
-- La vue `v_flux_handpick` est abandonnée : le front lit la table et
-- calcule les totaux depuis les lignes embarquées.
--
-- Le trigger de journal (`log_handpick_activity('flux', 'container_no')`)
-- lit ses colonnes de libellé via JSONB : une colonne absente donne un
-- libellé NULL, sans erreur. Il n'est pas retouché.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

DROP VIEW IF EXISTS public.v_flux_handpick;

ALTER TABLE public.flux_handpick
    DROP COLUMN IF EXISTS container_no,
    DROP COLUMN IF EXISTS conteneur_no_raw,
    DROP COLUMN IF EXISTS transport_mode,
    DROP COLUMN IF EXISTS port_arrival_date,
    DROP COLUMN IF EXISTS invoice_no,
    DROP COLUMN IF EXISTS invoice_date,
    DROP COLUMN IF EXISTS reference_externe,
    DROP COLUMN IF EXISTS status_auto;

-- ─── Transitions de statut sans status_auto ──────────────────────────

CREATE OR REPLACE FUNCTION public.auto_set_flux_handpick_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.status = 'annulé' THEN
        RETURN NEW;
    END IF;

    IF NEW.departure_date IS NOT NULL
       AND NEW.departure_date < CURRENT_DATE
       AND NEW.status = 'planifié'
    THEN
        NEW.status := 'en_transit';
    END IF;

    -- Transitions chaînées dans la même écriture.
    IF NEW.prev_dechargement_at IS NOT NULL
       AND NEW.prev_dechargement_at < now()
       AND NEW.status = 'en_transit'
    THEN
        NEW.status := 'reçu';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_flux_handpick_status_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.flux_handpick
    SET status = 'en_transit'
    WHERE status = 'planifié'
      AND departure_date IS NOT NULL
      AND departure_date < CURRENT_DATE;

    UPDATE public.flux_handpick
    SET status = 'reçu'
    WHERE status = 'en_transit'
      AND prev_dechargement_at IS NOT NULL
      AND prev_dechargement_at < now();
END;
$$;

-- Rafraîchit le cache de schéma de l'API.
NOTIFY pgrst, 'reload schema';
