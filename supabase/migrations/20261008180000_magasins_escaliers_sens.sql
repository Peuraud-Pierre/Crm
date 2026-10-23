-- Escaliers : sens depuis l'étage où ils sont posés. `descend` = l'escalier
-- part vers l'étage du dessous (trémie avec garde-corps en 3D) ; sinon il
-- monte. Idempotent.

ALTER TABLE public.equipements_magasin
    ADD COLUMN IF NOT EXISTS descend BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
