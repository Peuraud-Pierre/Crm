import { useMonthPages, type MonthGroup } from "@/shared/hooks/useMonthPages"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { referenceArrivageManuel } from "@/features/stock/types/arrivage-manuel.types"
import { ARRIVAGE_MONTHS_PER_PAGE } from "@/features/stock/constants"

export type ArrivageMonthGroup = MonthGroup<ArrivageManuelRow>

/**
 * Projection des arrivages pour le tableau : tri, groupement par mois et
 * pagination vivent dans `shared/hooks/useMonthPages`, partagé avec le stock
 * handpick. Ne reste ici que ce qui est propre aux arrivages — quelle date fait
 * référence, et quelle grandeur se cumule en pied de mois.
 *
 * ⚠ Ce groupement n'est PAS celui de `utils/arrivageGrouping.ts::groupByMonth`,
 * qui sert à l'export et à l'impression. Les deux divergent : celui-ci retombe
 * sur `created_at` quand aucune date de référence n'existe, garde le libellé de
 * mois en minuscules (la capitale vient d'un `capitalize` CSS) et n'impose pas
 * « Sans date » en dernier. Les fusionner changerait le rendu de l'un des deux ;
 * la convergence est une dette identifiée, pas un nettoyage à faire au passage.
 */
export function useArrivagePages(
    rows: ArrivageManuelRow[] | undefined,
    page: number | null,
) {
    return useMonthPages(
        rows,
        (row) => ({
            id: row.id,
            // Déchargement prévu → Le Havre → départ, et à défaut la date de
            // saisie : une ligne sans aucune date reste rattachée à un mois
            // plutôt que de tomber dans « Sans date ».
            referenceAt: referenceArrivageManuel(row) ?? row.created_at,
            upcomingAt: row.prev_dechargement_at,
            weight: row.total_weight_kg ?? 0,
        }),
        { page, monthsPerPage: ARRIVAGE_MONTHS_PER_PAGE },
    )
}
