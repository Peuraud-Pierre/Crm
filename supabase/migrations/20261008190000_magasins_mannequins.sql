-- Magasins : mannequins, nouveau type d'équipement du plan.
-- Dépend de 20261008140000_magasins_colimacon. Idempotent.

ALTER TABLE public.equipements_magasin DROP CONSTRAINT IF EXISTS equipements_magasin_kind_valid;
ALTER TABLE public.equipements_magasin ADD CONSTRAINT equipements_magasin_kind_valid
    CHECK (kind IN ('caisse', 'entree', 'sortie', 'entree_sortie', 'escalier', 'escalier_colimacon', 'mannequin'));

NOTIFY pgrst, 'reload schema';
