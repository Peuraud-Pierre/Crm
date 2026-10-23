-- Magasins : formes libres des zones (meubles de merch, îlots, gondoles…).
-- Dépend de 20261007100000_magasins. Idempotent.
--
-- `forme` est le polygone tracé point par point, en coordonnées RELATIVES au
-- rectangle de la zone (pos_x, pos_y, width, height) : [[u, v], …] avec u, v
-- entre 0 et 1. Le rectangle reste la boîte englobante : déplacer,
-- redimensionner ou tourner la zone emporte sa forme sans recalcul.
-- NULL = la zone est son rectangle.

ALTER TABLE public.zones_magasin ADD COLUMN IF NOT EXISTS forme JSONB;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zones_magasin_forme_polygon') THEN
        ALTER TABLE public.zones_magasin ADD CONSTRAINT zones_magasin_forme_polygon
            CHECK (forme IS NULL OR (jsonb_typeof(forme) = 'array' AND jsonb_array_length(forme) >= 3));
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
