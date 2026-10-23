-- ============================================================
-- Fix: exclure les container_no non conformes (statuts, notes…)
-- Date: 2026-04-21
--
-- L'Excel source contient parfois des valeurs textuelles non-containers
-- dans la colonne container ("COMPLET", "LIVRÉ PAR THOMAS", etc.). Ces
-- lignes polluaient le listage d'arrivages avec des entrées fantômes.
--
-- Filtre : on ne garde que les valeurs qui ressemblent à un code
-- BIC / ISO 6346. Standard strict = ^[A-Z]{4}[0-9]{7}$ ; on reste
-- légèrement plus souple (≥3 lettres + ≥6 chiffres) pour absorber
-- d'éventuels formats historiques.
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
WHERE
    -- Container conforme BIC/ISO 6346 (≥3 lettres + ≥6 chiffres, tolérant)
    UPPER(TRIM(COALESCE(f.container_no, ad.conteneur_no, ad.n_conteneur)))
    ~ '^[A-Z]{3,4}[0-9]{6,7}$';
