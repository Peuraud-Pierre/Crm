-- ============================================================
-- Archivage des annonces
--
-- Ajoute archived_at (timestamptz nullable) sur public.annonce :
--   NULL      → annonce active
--   non NULL  → annonce archivée (date d'archivage)
--
-- L'archivage est un masquage réversible : l'annonce reste en base
-- et disparaît du carrousel + de la liste par défaut, contrairement
-- à la suppression qui est définitive.
-- ============================================================

ALTER TABLE public.annonce
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index partiel : les lectures courantes ne portent que sur les actives.
CREATE INDEX IF NOT EXISTS annonce_active_idx
    ON public.annonce (start_date DESC)
    WHERE archived_at IS NULL;

COMMENT ON COLUMN public.annonce.archived_at IS
    'Date d''archivage. NULL = annonce active.';
