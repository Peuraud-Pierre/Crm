-- Magasins : un mannequin se rattache à une zone, un rayon ou un portant,
-- comme un portant à sa zone. `zone_id` NULL = rattaché à rien. Supprimer la
-- zone détache le mannequin sans le supprimer. Idempotent.

ALTER TABLE public.equipements_magasin
    ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones_magasin(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipements_magasin_zone ON public.equipements_magasin (zone_id) WHERE zone_id IS NOT NULL;

-- La zone doit être du même magasin et du même étage que l'équipement.
CREATE OR REPLACE FUNCTION public.equipements_magasin_check_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    zone_magasin UUID;
    zone_etage   UUID;
BEGIN
    IF NEW.zone_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT z.magasin_id, z.etage_id INTO zone_magasin, zone_etage
    FROM public.zones_magasin z
    WHERE z.id = NEW.zone_id;
    IF zone_magasin IS NULL THEN
        RAISE EXCEPTION 'Zone introuvable';
    END IF;
    IF zone_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'La zone appartient à un autre magasin';
    END IF;
    IF zone_etage IS DISTINCT FROM NEW.etage_id THEN
        RAISE EXCEPTION 'La zone est sur un autre étage';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS equipements_magasin_check_zone ON public.equipements_magasin;
CREATE TRIGGER equipements_magasin_check_zone
    BEFORE INSERT OR UPDATE OF zone_id, etage_id ON public.equipements_magasin
    FOR EACH ROW EXECUTE FUNCTION public.equipements_magasin_check_zone();

NOTIFY pgrst, 'reload schema';
