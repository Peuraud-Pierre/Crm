-- ============================================================
-- Filtre le snapshot mensuel des produits recherchés sur updated_at
-- Date: 2026-09-04
--
-- snapshot_produit_recherche_monthly_stats() (migration 20260903100000)
-- scannait tout client_crm sans filtre de date : chaque mois recomptait
-- l'inventaire complet des produits recherchés existants, pas seulement
-- les briefs modifiés ce mois-là — un produit ajouté en janvier et jamais
-- retouché depuis se retrouvait compté chaque mois suivant.
--
-- Cette migration restreint le scan aux clients dont client_crm.updated_at
-- tombe dans le mois du snapshot. Approximation assumée : updated_at bouge
-- dès qu'un champ quelconque du brief change (pas seulement la section
-- "Produits recherchés"), faute de date par entrée recherche[] en base.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.snapshot_produit_recherche_monthly_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_month date := date_trunc('month', now())::date;
BEGIN
    DELETE FROM public.crm_produit_recherche_monthly_stats WHERE snapshot_month = v_month;

    INSERT INTO public.crm_produit_recherche_monthly_stats (snapshot_month, product_name, total_entries)
    SELECT v_month, product_name, COUNT(*)
    FROM (
        SELECT
            upper(left(trim(entry->>'nom'), 1))
                || lower(substring(trim(entry->>'nom') from 2)) AS product_name
        FROM (
            SELECT CASE
                WHEN jsonb_typeof(brief) = 'string' THEN NULLIF(brief#>>'{}', '')::jsonb
                ELSE brief
            END AS brief_json
            FROM public.client_crm
            WHERE brief IS NOT NULL
              AND updated_at >= v_month
              AND updated_at < (v_month + INTERVAL '1 month')
        ) parsed
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(parsed.brief_json->'recherche') = 'array'
                 THEN parsed.brief_json->'recherche'
                 ELSE '[]'::jsonb
            END
        ) AS entry
        WHERE trim(entry->>'nom') <> ''
    ) named_entries
    GROUP BY product_name;
END;
$$;

-- Re-snapshot du mois courant avec le nouveau filtre.
SELECT public.snapshot_produit_recherche_monthly_stats();

COMMIT;
