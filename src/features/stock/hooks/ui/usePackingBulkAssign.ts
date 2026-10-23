import { useMemo, useState } from "react"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"
import { usePackingSelection } from "./usePackingSelection"

/** Au-delà de ce nombre, un geste de masse demande confirmation. */
const BULK_CONFIRM_THRESHOLD = 10

/**
 * Le geste « cocher plusieurs libellés, leur donner une catégorie ».
 *
 * Sorti de `PackingReviewPanel`, qui doit rester l'écran (strates, clavier,
 * focus) et non l'orchestrateur d'un geste. Le panneau franchissait à nouveau
 * le seuil de 400 lignes de `CLAUDE.md`.
 *
 * Deux choses s'y décident, et elles ne sont pas cosmétiques :
 *
 *  · **Le geste est un ACCEPT, pas un ASSIGN.** Il passe par `onAcceptMany`,
 *    qui ne remplit que les lignes encore sans catégorie — un libellé dont une
 *    ligne a déjà été réattribuée à la main garde cet arbitrage. C'est la
 *    distinction que ce module protège partout ailleurs, et l'intitulé de la
 *    barre le dit.
 *  · **Au-delà de dix libellés, on confirme.** En dessous, l'annulation répare
 *    en un geste ; au-delà, une erreur de sélection coûte trop cher pour être
 *    seulement réversible.
 */
export function usePackingBulkAssign(
    unmatched: readonly PackingGroup[],
    onAcceptMany?: (assignments: { rawLabelKey: string; categoryId: string }[]) => void,
) {
    // Bornée aux libellés à classer AFFICHÉS : une case cochée hors écran
    // ferait écrire sur un libellé que personne ne regarde.
    const selectableKeys = useMemo(() => unmatched.map((g) => g.key), [unmatched])
    const selection = usePackingSelection(selectableKeys)
    const [pendingCategory, setPendingCategory] = useState<string | null>(null)

    /** Colis couverts : la grandeur qui mesure le risque dans tout cet écran. */
    const packages = useMemo(
        () =>
            unmatched
                .filter((group) => selection.selected.has(group.key))
                .reduce((sum, group) => sum + group.totalPackages, 0),
        [unmatched, selection.selected],
    )

    const commit = (categoryId: string) => {
        if (!onAcceptMany) return
        onAcceptMany([...selection.selected].map((rawLabelKey) => ({ rawLabelKey, categoryId })))
        selection.clear()
        setPendingCategory(null)
    }

    return {
        selection,
        packages,
        selectableCount: selectableKeys.length,
        enabled: Boolean(onAcceptMany),
        /** Catégorie en attente de confirmation, `null` si aucune. */
        pendingCategory,
        cancel: () => setPendingCategory(null),
        /** Demande l'attribution : confirme d'abord si la sélection est large. */
        request: (categoryId: string) => {
            if (selection.count > BULK_CONFIRM_THRESHOLD) setPendingCategory(categoryId)
            else commit(categoryId)
        },
        commit,
    }
}
