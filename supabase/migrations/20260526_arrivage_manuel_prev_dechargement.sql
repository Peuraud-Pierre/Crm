-- Remplace les 3 colonnes séparées (date + heure + jour) par un seul TIMESTAMPTZ.
-- Le nom du jour est dérivé côté front depuis le timestamp.

BEGIN;

ALTER TABLE public.arrivage_manuel
    ADD COLUMN prev_dechargement_at TIMESTAMPTZ;

-- Migration des données existantes
UPDATE public.arrivage_manuel
SET prev_dechargement_at = (
    prev_dechargement_date::TEXT
    || 'T'
    || COALESCE(prev_dechargement_heure, '00:00')
    || ':00+00'
)::TIMESTAMPTZ
WHERE prev_dechargement_date IS NOT NULL;

ALTER TABLE public.arrivage_manuel
    DROP COLUMN prev_dechargement_date,
    DROP COLUMN prev_dechargement_heure,
    DROP COLUMN prev_dechargement_jour;

COMMIT;
