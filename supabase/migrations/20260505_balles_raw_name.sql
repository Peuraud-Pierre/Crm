-- Ajoute la description brute issue de la packing list (avant matching trigramme).
-- `category_id` continue à pointer vers la catégorie résolue (matching ou auto-créée),
-- `raw_name` conserve la description originale telle qu'écrite dans l'Excel.

ALTER TABLE public.balles_gestion
    ADD COLUMN IF NOT EXISTS raw_name text;

COMMENT ON COLUMN public.balles_gestion.raw_name IS
    'Description brute de l''item issue de la packing list (avant matching de catégorie).';
