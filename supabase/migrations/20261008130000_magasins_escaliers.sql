-- Magasins : escaliers, nouveau type d'équipement du plan.
-- Dépend de 20261007110000_magasins_equipements. Idempotent.
--
-- Un escalier se pose, se déplace, se redimensionne et se tourne comme une
-- caisse ou une porte. Il monte dans le sens de sa longueur, vers l'extrémité
-- droite (ou basse) du rectangle avant rotation : la flèche du plan l'indique.

ALTER TABLE public.equipements_magasin DROP CONSTRAINT IF EXISTS equipements_magasin_kind_valid;
ALTER TABLE public.equipements_magasin ADD CONSTRAINT equipements_magasin_kind_valid
    CHECK (kind IN ('caisse', 'entree', 'sortie', 'entree_sortie', 'escalier'));

-- Correctif de 20261008110000_magasins_etages : sa première version de ce
-- contrôle lisait NEW.parent_id aussi pour les équipements, qui n'ont pas
-- cette colonne — toute création de caisse, de porte (ou d'escalier) échouait
-- (« record "new" has no field "parent_id" »). Remplacée ici pour les bases
-- où cette version a déjà été exécutée.
CREATE OR REPLACE FUNCTION public.magasin_check_etage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    etage_magasin UUID;
    parent_etage  UUID;
BEGIN
    SELECT e.magasin_id INTO etage_magasin FROM public.etages_magasin e WHERE e.id = NEW.etage_id;
    IF etage_magasin IS NULL THEN
        RAISE EXCEPTION 'Étage introuvable';
    END IF;
    IF etage_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'L''étage appartient à un autre magasin';
    END IF;

    IF TG_TABLE_NAME = 'zones_magasin' THEN
        -- Bloc imbriqué et non `AND` : PL/pgSQL résout NEW.parent_id avant
        -- d'évaluer la condition, et les équipements n'ont pas cette colonne.
        IF NEW.parent_id IS NOT NULL THEN
            SELECT z.etage_id INTO parent_etage FROM public.zones_magasin z WHERE z.id = NEW.parent_id;
            IF parent_etage IS DISTINCT FROM NEW.etage_id THEN
                RAISE EXCEPTION 'La zone parente est sur un autre étage';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
