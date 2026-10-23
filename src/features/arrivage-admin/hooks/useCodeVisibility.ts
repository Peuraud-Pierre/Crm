import { useCallback, useState } from "react"
import { useCopyFeedback } from "@/features/arrivage-admin/hooks/useCopyFeedback"

/**
 * État d'affichage des codes d'invitation : masquage individuel, plus le
 * retour « copié » partagé (`useCopyFeedback`).
 *
 * Purement présentationnel — d'où `hooks/` et non `hooks/data/`.
 */
export function useCodeVisibility() {
    const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set())
    const { isCopied, copy } = useCopyFeedback()

    const isVisible = useCallback(
        (id: string) => visibleIds.has(id),
        [visibleIds]
    )

    const toggleVisibility = useCallback((id: string) => {
        setVisibleIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    return { isVisible, isCopied, toggleVisibility, copy }
}
