-- Magasins : regroupement d'équipements (escaliers fusionnés en un seul).
-- Dépend de 20261007110000_magasins_equipements. Idempotent.
--
-- Des volées partageant le même `groupe` forment UN escalier : un seul code
-- affiché, sélection, déplacement et suppression d'un bloc. Chaque volée
-- garde son dessin (marches, flèche) et son volume 3D. NULL = seul.

ALTER TABLE public.equipements_magasin ADD COLUMN IF NOT EXISTS groupe UUID;

CREATE INDEX IF NOT EXISTS idx_equipements_magasin_groupe
    ON public.equipements_magasin (groupe) WHERE groupe IS NOT NULL;

NOTIFY pgrst, 'reload schema';
