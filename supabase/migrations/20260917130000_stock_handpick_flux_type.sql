-- ============================================================
-- Stock Handpick — type d'expédition
-- Date: 2026-09-17
--
-- Colonne `type` en texte libre sur l'en-tête de flux, saisie dans le
-- formulaire et affichée dans le tableau des expéditions.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

ALTER TABLE public.flux_handpick
    ADD COLUMN IF NOT EXISTS type text NULL;

NOTIFY pgrst, 'reload schema';
