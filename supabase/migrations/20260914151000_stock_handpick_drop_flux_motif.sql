-- ============================================================
-- stock_handpick — retrait de `motif` sur les en-têtes de flux
--
-- `flux_handpick.motif` était le miroir du motif porté par les
-- mouvements avant la séparation en-tête / liste de colisage
-- (20260914150000). À l'usage il ne dit rien de plus que `direction` :
-- un en-tête « in » est un arrivage, un « out » un départ, et les
-- motifs d'ajustement se lisent sur la ligne, pas sur l'expédition.
-- L'UI ne le saisit plus ; la colonne NOT NULL bloquerait toute
-- création.
--
-- La vue doit tomber d'abord : elle projette `f.*`, PostgreSQL refuse
-- le DROP COLUMN tant qu'elle en dépend. Elle est recréée à
-- l'identique de la section 7 de 20260914150000.
--
-- Aucun GRANT à rejouer : la vue n'en porte pas, la RLS passe par
-- `security_invoker`.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

DROP VIEW IF EXISTS public.v_flux_handpick;

ALTER TABLE public.flux_handpick
    DROP CONSTRAINT IF EXISTS flux_handpick_motif_matches_direction;

ALTER TABLE public.flux_handpick
    DROP COLUMN IF EXISTS motif;

-- ─── Vue de lecture : en-tête + totaux de sa liste de colisage ──────────
-- `security_invoker` : la vue s'exécute avec les droits de l'appelant, donc
-- la RLS de `flux_handpick` et de `mouvements_handpick` s'applique. Sans
-- cette option, une vue PostgreSQL s'exécute avec les droits de son
-- propriétaire et court-circuiterait silencieusement les policies.

CREATE VIEW public.v_flux_handpick
WITH (security_invoker = true) AS
SELECT
    f.*,
    COALESCE(l.lignes_count,    0)    AS lignes_count,
    -- Les quantités ne s'additionnent qu'à unité égale : deux totaux
    -- distincts plutôt qu'une somme qui mélangerait kilos et pièces.
    COALESCE(l.total_weight_kg,  0)   AS total_weight_kg,
    COALESCE(l.total_qty,        0)   AS total_qty,
    COALESCE(l.total_value,      0)   AS total_value
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
    'En-têtes de flux augmentés des totaux de leur liste de colisage. '
    'Les totaux sont DÉRIVÉS des lignes et jamais stockés : contrairement au '
    'stock principal, qui les saisit à la main faute de détail, le handpick a '
    'le détail — c''est lui qui fait foi.';
