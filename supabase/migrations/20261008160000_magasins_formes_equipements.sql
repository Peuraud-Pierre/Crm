-- Magasins : formes libres des équipements (caisse en L, comptoir arrondi…).
-- Dépend de 20261007110000_magasins_equipements. Idempotent.
--
-- Même principe que zones_magasin.forme (20261008120000) : polygone relatif
-- au rectangle de l'équipement ([u, v] entre 0 et 1) ; NULL = le rectangle.

ALTER TABLE public.equipements_magasin ADD COLUMN IF NOT EXISTS forme JSONB;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipements_magasin_forme_polygon') THEN
        ALTER TABLE public.equipements_magasin ADD CONSTRAINT equipements_magasin_forme_polygon
            CHECK (forme IS NULL OR (jsonb_typeof(forme) = 'array' AND jsonb_array_length(forme) >= 3));
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
