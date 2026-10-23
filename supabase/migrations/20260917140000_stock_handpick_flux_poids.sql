-- ============================================================
-- Stock Handpick — poids saisi sur l'en-tête de flux
-- Date: 2026-09-17
--
-- `poids_kg` : poids de l'expédition saisi à la main. Côté front, il
-- l'emporte sur le poids calculé depuis les lignes de colisage en kg.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

ALTER TABLE public.flux_handpick
    ADD COLUMN IF NOT EXISTS poids_kg numeric(12,2) NULL;

ALTER TABLE public.flux_handpick
    DROP CONSTRAINT IF EXISTS flux_handpick_poids_positive;
ALTER TABLE public.flux_handpick
    ADD CONSTRAINT flux_handpick_poids_positive CHECK (poids_kg IS NULL OR poids_kg >= 0);

NOTIFY pgrst, 'reload schema';
