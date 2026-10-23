-- ─────────────────────────────────────────────────────────────────────────────
-- Packing list — les totaux de pièces et de kilos terminent l'addition
--                que le fournisseur n'a pas écrite
-- ─────────────────────────────────────────────────────────────────────────────
--
-- LE PROBLÈME
-- -----------
-- `total_pieces` et `total_weight_kg` sommaient la seule colonne TOTAL PCS/KG
-- du fichier (`declared_total`). Or le fournisseur la laisse VIDE sur la
-- plupart des lignes en kilos — 3 sur 4 dans CONTENEUR GR153, 9 sur 10 dans
-- GR154 —, et une ligne sans total comptait alors pour zéro.
--
-- Mesuré sur les deux packings réelles (fixtures `src/features/stock/
-- __fixtures__/packing/`) :
--
--     fichier   poids affiché   poids réel
--     GR153         75 kg        2 370 kg
--     GR154        200 kg        2 475 kg
--
-- Un facteur trente, sur le nombre même qui sert ensuite à confronter la
-- packing aux totaux saisis sur l'arrivage (`PACKING_GAP_TOLERANCE`) : l'écart
-- affiché était faux, et la vérification ne pouvait rien conclure.
--
-- LA CORRECTION
-- -------------
-- `COALESCE(declared_total, units_per_package * package_count)`. Ce n'est pas
-- une estimation : c'est LE calcul du document, celui que la colonne TOTAL
-- reprend quand elle est renseignée (« 25 kg × 3 colis = 75 ») et que le
-- contrôle d'intégrité vérifie déjà ligne à ligne.
--
-- `declared_total` reste prioritaire dès qu'elle existe, y compris quand elle
-- ne tombe pas juste : le document fait foi, et l'écart est signalé comme
-- anomalie au lieu d'être corrigé en douce. `rows_failing_math` est donc
-- inchangé — une ligne sans total reste une ligne à faire relire.
--
-- Les deux autres implémentations de la même règle doivent s'accorder :
-- `utils/packingGrouping.ts` (`ligneTotal`) côté front, et le service
-- `packing-api` s'il recalcule ces totaux.
--
-- La vue est RECRÉÉE et non remplacée : `p.*` fige la liste des colonnes de
-- `packing_list` au moment de la création (même raison qu'au 2026-09-18).

DROP VIEW IF EXISTS public.v_packing_list_summary;

CREATE VIEW public.v_packing_list_summary
WITH (security_invoker = true) AS
SELECT
    p.*,
    COUNT(l.id)::int                                                      AS line_count,
    COUNT(l.id) FILTER (WHERE l.category_id IS NULL)::int                 AS lines_unmatched,
    COUNT(l.id) FILTER (WHERE l.resolution = 'dictionary')::int           AS lines_from_dictionary,
    COUNT(l.id) FILTER (WHERE l.resolution = 'model')::int                AS lines_from_model,
    COUNT(l.id) FILTER (WHERE l.resolution = 'human')::int                AS lines_reviewed,
    COALESCE(SUM(l.package_count), 0)::int                                AS total_packages,
    COALESCE(SUM(
        COALESCE(l.declared_total, l.units_per_package * l.package_count)
    ) FILTER (WHERE l.unit_kind = 'pcs'), 0)                              AS total_pieces,
    COALESCE(SUM(
        COALESCE(l.declared_total, l.units_per_package * l.package_count)
    ) FILTER (WHERE l.unit_kind = 'kgs'), 0)                              AS total_weight_kg,
    COUNT(l.id) FILTER (
        WHERE l.package_count IS NOT NULL
          AND l.units_per_package IS NOT NULL
          AND (l.declared_total IS NULL
               OR l.declared_total <> l.units_per_package * l.package_count)
    )::int                                                                AS rows_failing_math,
    CASE
        WHEN p.declared_package_count IS NULL THEN NULL
        ELSE COALESCE(SUM(l.package_count), 0)::int - p.declared_package_count
    END                                                                   AS package_count_gap
FROM public.packing_list p
LEFT JOIN public.packing_list_ligne l ON l.packing_list_id = p.id
GROUP BY p.id;

COMMENT ON VIEW public.v_packing_list_summary IS
    'Synthèse d''une packing list. total_pieces et total_weight_kg retiennent le total déclaré par le fichier, et à défaut contenu par colis × nombre de colis — le fournisseur laisse la colonne TOTAL vide sur la plupart des lignes en kilos.';
