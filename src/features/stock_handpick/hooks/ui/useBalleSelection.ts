import { useCallback, useMemo, useState } from "react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

/**
 * Une balle empruntée se range avec « Rendre », une balle éclatée n'est plus
 * en stock : ni l'une ni l'autre ne se déplace par lot.
 */
export const isMovable = (balle: Pick<BalleHandpick, "borrowed_by" | "is_eclatee">) =>
    balle.borrowed_by === null && !balle.is_eclatee

/** État de coche d'une carte ; `undefined` hors mode sélection. */
export function selectionStateOf(
    selectedIds: ReadonlySet<string> | undefined,
    balle: BalleHandpick,
): "selected" | "idle" | "locked" | undefined {
    if (!selectedIds) return undefined
    if (!isMovable(balle)) return "locked"
    return selectedIds.has(balle.id) ? "selected" : "idle"
}

/**
 * Mode sélection de l'inventaire : tant qu'il est actif, cliquer une balle la
 * coche au lieu d'ouvrir sa fiche. Quitter le mode vide la sélection.
 */
export function useBalleSelection() {
    const [active, setActive] = useState(false)
    const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

    const start = useCallback(() => setActive(true), [])
    const clear = useCallback(() => setSelected(new Set()), [])
    const stop = useCallback(() => {
        setActive(false)
        setSelected(new Set())
    }, [])

    const toggle = useCallback((balle: BalleHandpick) => {
        if (!isMovable(balle)) return
        setSelected((current) => {
            const next = new Set(current)
            if (next.has(balle.id)) next.delete(balle.id)
            else next.add(balle.id)
            return next
        })
    }, [])

    return useMemo(
        () => ({ active, selected, start, stop, clear, toggle }),
        [active, selected, start, stop, clear, toggle],
    )
}

export type BalleSelection = ReturnType<typeof useBalleSelection>
