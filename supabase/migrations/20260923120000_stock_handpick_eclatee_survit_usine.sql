-- ============================================================
-- Stock handpick — une balle éclatée survit à la suppression de son usine
-- ============================================================
-- `balles_handpick.fournisseur_id` est en ON DELETE RESTRICT : une usine
-- (fournisseur) rattachée à la moindre balle ne pouvait pas être supprimée,
-- même quand ces balles étaient éclatées, donc sorties du stock.
--
--   · `fournisseur_label` : instantané du nom de l'usine, posé par trigger
--     au passage `is_eclatee` false → true, et rempli ici pour les balles
--     déjà éclatées. Les stats gardent l'usine même après sa suppression.
--   · Trigger BEFORE DELETE sur `fournisseurs_handpick` : détache l'usine
--     des balles ÉCLATÉES seulement (nom recopié s'il manque). La FK reste
--     RESTRICT : une usine qui a encore des balles en stock reste
--     insupprimable.
--
-- SECURITY DEFINER : supprimer une usine relève du droit « paramètres » ;
-- l'utilisateur n'a pas forcément `inventaire.update`, que la RLS des balles
-- exigerait pour ce détachement.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

ALTER TABLE public.balles_handpick
    ADD COLUMN IF NOT EXISTS fournisseur_label TEXT NULL;

COMMENT ON COLUMN public.balles_handpick.fournisseur_label IS
    'Nom de l''usine au moment de l''éclatement. Survit à la suppression de '
    'l''usine (fournisseur_id passe alors à NULL).';

-- Rattrapage des balles déjà éclatées.
UPDATE public.balles_handpick b
   SET fournisseur_label = f.name
  FROM public.fournisseurs_handpick f
 WHERE b.fournisseur_id = f.id
   AND b.is_eclatee
   AND b.fournisseur_label IS NULL;

-- Instantané posé à l'éclatement, quel que soit le chemin d'écriture.
CREATE OR REPLACE FUNCTION public.snapshot_fournisseur_on_eclatement_handpick()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.is_eclatee AND NOT OLD.is_eclatee AND NEW.fournisseur_label IS NULL THEN
        SELECT f.name INTO NEW.fournisseur_label
          FROM public.fournisseurs_handpick f
         WHERE f.id = NEW.fournisseur_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_fournisseur_on_eclatement ON public.balles_handpick;
CREATE TRIGGER snapshot_fournisseur_on_eclatement
    BEFORE UPDATE OF is_eclatee ON public.balles_handpick
    FOR EACH ROW EXECUTE FUNCTION public.snapshot_fournisseur_on_eclatement_handpick();

CREATE OR REPLACE FUNCTION public.detach_eclatees_from_fournisseur_handpick()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.balles_handpick
       SET fournisseur_label = COALESCE(fournisseur_label, OLD.name),
           fournisseur_id    = NULL
     WHERE fournisseur_id = OLD.id
       AND is_eclatee;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS detach_eclatees_before_fournisseur_delete ON public.fournisseurs_handpick;
CREATE TRIGGER detach_eclatees_before_fournisseur_delete
    BEFORE DELETE ON public.fournisseurs_handpick
    FOR EACH ROW EXECUTE FUNCTION public.detach_eclatees_from_fournisseur_handpick();

NOTIFY pgrst, 'reload schema';
