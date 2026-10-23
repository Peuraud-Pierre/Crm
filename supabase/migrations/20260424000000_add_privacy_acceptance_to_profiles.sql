-- ============================================================
-- Privacy policy & legal notice acceptance tracking
-- ============================================================
-- Ajoute deux colonnes à public.profiles :
--   - privacy_accepted_at       : horodatage de l'acceptation
--   - privacy_accepted_version  : version du texte acceptée
--
-- La version est gérée côté application via une constante
-- PRIVACY_VERSION. Lorsqu'on bump cette version, tous les
-- utilisateurs devront re-accepter le texte mis à jour.
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS privacy_accepted_version TEXT;

-- Index partiel pour retrouver rapidement les utilisateurs
-- n'ayant pas encore accepté (utilisé par les dashboards admin).
CREATE INDEX IF NOT EXISTS idx_profiles_privacy_not_accepted
    ON public.profiles (user_id)
    WHERE privacy_accepted_at IS NULL;
