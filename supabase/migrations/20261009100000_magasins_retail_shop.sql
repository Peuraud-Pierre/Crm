-- Magasins : rattachement à une boutique de la console retail, qui affiche le
-- plan publié depuis nokk_project (PUT /api/v1/external/shops/:id/layout).
-- Dépend de 20261007100000_magasins. Idempotent.

ALTER TABLE public.magasins
    ADD COLUMN IF NOT EXISTS retail_shop_id uuid,
    ADD COLUMN IF NOT EXISTS retail_published_at timestamptz;

-- Une boutique retail n'affiche qu'un plan : un seul magasin par boutique.
CREATE UNIQUE INDEX IF NOT EXISTS magasins_retail_shop_id_key
    ON public.magasins (retail_shop_id) WHERE retail_shop_id IS NOT NULL;

COMMENT ON COLUMN public.magasins.retail_shop_id IS 'shops.id de la console retail (base séparée : pas de FK).';
COMMENT ON COLUMN public.magasins.retail_published_at IS 'Dernière publication du plan vers retail ; null = jamais publié.';

NOTIFY pgrst, 'reload schema';
