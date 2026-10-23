-- ============================================================
-- Stock Handpick — date de référence exposée par la vue des flux
-- Date: 2026-09-14
-- Dépend de : 20260914151000 (dernière définition de v_flux_handpick)
--
-- Contexte
-- --------
-- Le tableau des flux charge les expéditions par paliers (`limit`), puis
-- les trie et les groupe par mois côté client sur leur DATE DE RÉFÉRENCE :
-- déchargement prévu, à défaut date de départ (`referenceFlux` dans
-- src/features/stock_handpick/types/flux.types.ts).
--
-- La requête, elle, triait sur `prev_dechargement_at` seul. Or l'ordre de
-- la requête décide de ce qui entre dans le palier : un départ n'a en
-- général pas de déchargement prévu, il passait donc systématiquement
-- derrière tous les arrivages datés — l'onglet Départs pouvait sembler
-- vide tant qu'on n'avait pas cliqué plusieurs fois sur « Charger plus ».
--
-- On expose la même cascade en colonne, pour que la requête trie comme
-- l'écran. Colonne AJOUTÉE EN FIN de vue : CREATE OR REPLACE VIEW
-- l'accepte sans DROP, les colonnes existantes restent à l'identique.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

CREATE OR REPLACE VIEW public.v_flux_handpick
WITH (security_invoker = true) AS
SELECT
    f.*,
    COALESCE(l.lignes_count,    0)    AS lignes_count,
    -- Les quantités ne s'additionnent qu'à unité égale : deux totaux
    -- distincts plutôt qu'une somme qui mélangerait kilos et pièces.
    COALESCE(l.total_weight_kg,  0)   AS total_weight_kg,
    COALESCE(l.total_qty,        0)   AS total_qty,
    COALESCE(l.total_value,      0)   AS total_value,
    -- Miroir SQL de `referenceFlux()` : à modifier ensemble.
    COALESCE(f.prev_dechargement_at, f.departure_date::timestamptz) AS reference_at
FROM public.flux_handpick f
LEFT JOIN LATERAL (
    SELECT
        count(*)                                                              AS lignes_count,
        sum(m.quantity)    FILTER (WHERE m.quantity_unit = 'kg')              AS total_weight_kg,
        sum(m.quantity)    FILTER (WHERE m.quantity_unit = 'pieces')          AS total_qty,
        sum(m.total_value)                                                    AS total_value
    FROM public.mouvements_handpick m
    WHERE m.flux_id = f.id
) l ON TRUE;

COMMENT ON VIEW public.v_flux_handpick IS
    'En-têtes de flux augmentés des totaux de leur liste de colisage et de leur '
    'date de référence (reference_at). Les totaux sont DÉRIVÉS des lignes et '
    'jamais stockés : contrairement au stock principal, qui les saisit à la main '
    'faute de détail, le handpick a le détail — c''est lui qui fait foi.';
