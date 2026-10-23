-- ============================================================
-- Ajouter support pour services dans watch_config
-- ============================================================

-- Ajouter colonne service_ids (array de service IDs)
ALTER TABLE public.watch_config
ADD COLUMN IF NOT EXISTS service_ids uuid[] DEFAULT NULL;

-- Ajouter commentaire
COMMENT ON COLUMN public.watch_config.service_ids IS 'UUIDs des services pour lesquels cette configuration est active. NULL = tous les services';

-- Créer index pour recherche
CREATE INDEX IF NOT EXISTS idx_watch_config_service_ids ON public.watch_config USING GIN (service_ids);

-- Créer fonction helper pour vérifier si une config est visible pour un service
CREATE OR REPLACE FUNCTION public.watch_config_visible_to_service(
    p_config_id INT,
    p_service_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT
        CASE
            WHEN service_ids IS NULL THEN TRUE
            WHEN service_ids = '{}' THEN TRUE
            ELSE p_service_id = ANY(service_ids)
        END
    FROM public.watch_config
    WHERE id = p_config_id;
$$;

-- Mettre à jour les configurations existantes pour être visibles à tous les services
UPDATE public.watch_config
SET service_ids = NULL
WHERE service_ids IS NULL;
