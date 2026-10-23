-- ============================================================
-- Fix: exclure les lignes sans container_no de la vue
-- Date: 2026-04-21
--
-- Le FULL OUTER JOIN peut produire des rows où f.container_no ET
-- ad.conteneur_no sont NULL (factures/arrivees_departs mal renseignées).
-- Ces lignes cassent le front (clé React non unique) et ne sont pas
-- éditables (arrivage_state.container_no est PK NOT NULL).
-- ============================================================

CREATE OR REPLACE VIEW public.v_arrivages AS
SELECT
    COALESCE(f.container_no, ad.conteneur_no) AS container_no,

    f.id  AS facture_id,
    ad.id AS arrivee_depart_id,

    -- Commercial (factures)
    f.invoice_no,
    f.date                  AS invoice_date,
    f.invoice_total,
    f.shipping_charges,
    f.total_invoice_value,
    f.total_invoice_usd,
    f.convert_rate_thb_usd,
    f.location,

    -- Transport (arrivees_departs)
    ad.pays                   AS origin_country,
    ad.provenance             AS origin_location,
    ad.mode                   AS transport_mode,
    ad.date_depart            AS departure_date,
    ad.date_arrivee_le_havre  AS port_arrival_date,
    ad.prev_dechargement_jour,
    ad.prev_dechargement_date,
    ad.prev_dechargement_heure,
    ad.poids                  AS total_weight_kg,
    ad.quantite               AS total_qty,

    -- État opérationnel (arrivage_state)
    COALESCE(s.status, 'planifié') AS status,
    s.fournisseur_id,
    s.docked_at,
    s.received_date,
    s.notes,
    s.livraison_id,

    COALESCE(f.created_at, ad.created_at, s.created_at) AS created_at,
    GREATEST(
        COALESCE(f.created_at, 'epoch'::timestamptz),
        COALESCE(ad.updated_at, 'epoch'::timestamptz),
        COALESCE(s.updated_at, 'epoch'::timestamptz)
    ) AS updated_at
FROM public.factures f
FULL OUTER JOIN public.arrivees_departs ad
    ON f.container_no = ad.conteneur_no
LEFT JOIN public.arrivage_state s
    ON s.container_no = COALESCE(f.container_no, ad.conteneur_no)
WHERE COALESCE(f.container_no, ad.conteneur_no) IS NOT NULL;
