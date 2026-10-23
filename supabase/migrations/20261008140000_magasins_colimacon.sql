-- Magasins : escaliers en colimaçon, nouveau type d'équipement du plan.
-- Dépend de 20261008130000_magasins_escaliers. Idempotent.
--
-- Il tourne autour de son centre, dans le sens des aiguilles d'une montre
-- vu de dessus, en partant du haut du cercle avant rotation.

ALTER TABLE public.equipements_magasin DROP CONSTRAINT IF EXISTS equipements_magasin_kind_valid;
ALTER TABLE public.equipements_magasin ADD CONSTRAINT equipements_magasin_kind_valid
    CHECK (kind IN ('caisse', 'entree', 'sortie', 'entree_sortie', 'escalier', 'escalier_colimacon'));

NOTIFY pgrst, 'reload schema';
