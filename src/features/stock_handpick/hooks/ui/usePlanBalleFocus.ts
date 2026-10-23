import { useEffect, useMemo, useState } from "react"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { EMPLACEMENT_PATH_SEPARATOR, UUID_DISPLAY_LENGTH } from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { focusFromSegments, type PlanFocus } from "@/features/stock_handpick/utils/planFocus"
import { emplacementOfPlanDetail } from "@/features/stock_handpick/utils/emplacementCode"

export interface PlanBalleFocus {
    focus: PlanFocus | null
    label: string
    /** Vrai une fois la cible lue : `focus` nul signifie alors « pas rangée ». */
    resolved: boolean
}

/**
 * Cible à faire briller dans le plan, d'après le segment `detail` de l'URL :
 * `/stock-handpick/plan/<id>` vise une balle (lue en base : elle peut être
 * hors du palier chargé de l'inventaire), `/stock-handpick/plan/emp-<id>`
 * un emplacement (« Voir dans le plan » de l'onglet Codes).
 */
export function usePlanBalleFocus(detail: string | undefined): PlanBalleFocus {
    const { fetchById, emplacementSegments } = useBalleHandpickContext()
    const emplacementId = emplacementOfPlanDetail(detail)
    const balleId = emplacementId ? undefined : detail
    const [balle, setBalle] = useState<{ id: string; row: BalleHandpick | null } | null>(null)

    useEffect(() => {
        if (!balleId) return
        let cancelled = false
        void fetchById(balleId).then((row) => {
            if (!cancelled) setBalle({ id: balleId, row })
        })
        return () => {
            cancelled = true
        }
    }, [balleId, fetchById])

    const current = balle && balle.id === balleId ? balle.row : null

    // Segments calculés dans le memo : `emplacementSegments` renvoie un
    // nouveau tableau à chaque appel, qui recréerait le focus à chaque rendu.
    const target = useMemo(() => {
        if (emplacementId) {
            const segments = emplacementSegments(emplacementId)
            return {
                focus: focusFromSegments(segments),
                label: segments?.join(EMPLACEMENT_PATH_SEPARATOR) ?? "Emplacement",
                found: segments !== null,
            }
        }
        return {
            focus: current ? focusFromSegments(emplacementSegments(current.emplacement_id)) : null,
            label: current
                ? current.raw_name ?? `Balle ${current.id.slice(0, UUID_DISPLAY_LENGTH)}`
                : "Balle",
            found: Boolean(balleId) && balle?.id === balleId,
        }
    }, [emplacementId, emplacementSegments, current, balleId, balle])

    return { focus: target.focus, label: target.label, resolved: target.found }
}
