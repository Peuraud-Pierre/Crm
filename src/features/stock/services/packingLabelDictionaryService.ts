// ── services/packingLabelDictionaryService.ts ─────────────────────────────────
// Couche service — tableau de correspondance libellé fournisseur → catégorie
// (table `packing_label_category`).
//
// C'est le mécanisme qui fait décroître la charge de vérification d'un
// conteneur au suivant. Il n'est JAMAIS écrit ici à l'import : seule la
// validation d'une packing list l'enseigne, côté base
// (`validate_packing_list`). Ce fichier le CONSULTE à l'import et permet de le
// corriger à la main depuis les paramètres du module.
//
// Mesure sur les deux packings réelles : dictionnaire appris sur CONTENEUR
// GR153, puis import de GR154 → 47 des 121 groupes (55 lignes sur 139) sont
// reconnus sans aucune décision humaine.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - services/packingImportMock.ts            → consultation à l'import
//   - hooks/data/usePackingList.ts             → provenance affichée à l'écran
//   - hooks/data/usePackingLabelDictionary.ts  → panneau des paramètres

import { PACKING_TABLES, supabasePacking } from "@/features/stock/services/packingListService"
import { PACKING_NORMALIZER_VERSION } from "@/features/stock/utils/packingGrouping"
import type { PackingLabelMapping } from "@/features/stock/types/packing-list.types"

/** Nombre de clés demandées par requête : `in.()` passe par l'URL. */
const LOOKUP_CHUNK = 200

function toMapping(row: Record<string, unknown>): PackingLabelMapping {
    return {
        ...(row as unknown as PackingLabelMapping),
        hit_count: Number(row.hit_count ?? 0),
        normalizer_version: Number(row.normalizer_version ?? 0),
    }
}

/**
 * Correspondances connues pour les clés demandées.
 *
 * Filtré sur `PACKING_NORMALIZER_VERSION` : une clé produite par un autre
 * normaliseur n'est pas comparable, et la laisser passer produirait un
 * rapprochement faux présenté comme certain.
 *
 * Sans `stock.packing.view`, la RLS renvoie un résultat vide et non une
 * erreur : l'import se déroule alors sans auto-résolution, ce qui est le
 * comportement voulu.
 */
export async function fetchMappingsForKeys(
    keys: readonly string[],
): Promise<Map<string, PackingLabelMapping>> {
    const unique = [...new Set(keys.filter((k) => k !== ""))]
    const found = new Map<string, PackingLabelMapping>()

    for (let i = 0; i < unique.length; i += LOOKUP_CHUNK) {
        const chunk = unique.slice(i, i + LOOKUP_CHUNK)
        const { data, error } = await supabasePacking
            .from(PACKING_TABLES.dictionary)
            .select("*")
            .eq("normalizer_version", PACKING_NORMALIZER_VERSION)
            .in("raw_label_key", chunk)

        if (error) throw error
        for (const row of data ?? []) {
            const mapping = toMapping(row)
            found.set(mapping.raw_label_key, mapping)
        }
    }

    return found
}

/** Tout le tableau, le plus confirmé d'abord : la vue des paramètres. */
export async function fetchAllMappings(): Promise<PackingLabelMapping[]> {
    const { data, error } = await supabasePacking
        .from(PACKING_TABLES.dictionary)
        .select("*")
        .order("hit_count", { ascending: false })
        .order("raw_label_sample", { ascending: true })

    if (error) throw error
    return (data ?? []).map(toMapping)
}

/**
 * Corrige une correspondance à la main. Le compteur de confirmations n'est pas
 * touché : il dit combien de packings l'ont confirmée, pas combien de fois
 * elle a été modifiée.
 */
export async function updateMappingCategory(
    rawLabelKey: string,
    categoryId: string,
): Promise<void> {
    const { error } = await supabasePacking
        .from(PACKING_TABLES.dictionary)
        .update({ category_id: categoryId })
        .eq("raw_label_key", rawLabelKey)

    if (error) throw error
}

/**
 * Oublie une correspondance. Les packings déjà validées gardent leurs
 * catégories : le tableau ne sert qu'aux imports à venir.
 *
 * Exige `stock.packing.delete`, attribuée à personne par défaut.
 */
export async function deleteMapping(rawLabelKey: string): Promise<void> {
    const { error } = await supabasePacking
        .from(PACKING_TABLES.dictionary)
        .delete()
        .eq("raw_label_key", rawLabelKey)

    if (error) throw error
}
