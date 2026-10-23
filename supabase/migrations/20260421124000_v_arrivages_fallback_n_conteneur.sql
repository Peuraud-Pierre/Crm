-- ============================================================
-- Fix: fallback n_conteneur si conteneur_no est NULL
-- Date: 2026-04-21
--
-- Dans arrivees_departs, deux colonnes peuvent porter le numéro :
--   - n_conteneur  (col M de l'Excel interne)
--   - conteneur_no (col M', clé UNIQUE, supposée matcher factures.container_no)
--
-- Quand le parser trouve le numéro uniquement dans la col M, la ligne
-- n'apparaît pas fusionnée avec la facture correspondante.
-- La jointure utilise désormais COALESCE(conteneur_no, n_conteneur).
-- ============================================================

CREATE OR REPLACE VIEW public.v_arrivages AS
SELECT
    UPPER(TRIM(COALESCE(
        f.container_no,
        ad.conteneur_no,
        ad.n_conteneur
    ))) AS container_no,

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
    ON UPPER(TRIM(f.container_no))
     = UPPER(TRIM(COALESCE(ad.conteneur_no, ad.n_conteneur)))
LEFT JOIN public.arrivage_state s
    ON UPPER(TRIM(s.container_no))
     = UPPER(TRIM(COALESCE(f.container_no, ad.conteneur_no, ad.n_conteneur)))
WHERE COALESCE(f.container_no, ad.conteneur_no, ad.n_conteneur) IS NOT NULL;
