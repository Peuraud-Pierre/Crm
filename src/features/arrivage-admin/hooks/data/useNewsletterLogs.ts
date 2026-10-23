import { useCallback, useEffect, useRef, useState } from "react"
import { fetchApiLogs } from "@/features/arrivage-admin/services/newsletterService"
import {
    LOGS_AUTO_REFRESH_MS,
    LOGS_PAGE_SIZE,
} from "@/features/arrivage-admin/constants"
import type { ApiLogLine, LogFilters } from "@/features/arrivage-admin/types"

/**
 * Console de logs du service Go.
 *
 * Pagination **par curseur** (`before_id`) et non numérotée : un COUNT exact
 * sur une table de logs coûte trop cher — le dépôt s'y est déjà brûlé
 * (`appLogsService.ts` utilise `count: "planned"` après un timeout 57014). On
 * garde donc une pile des curseurs visités pour permettre le retour arrière.
 *
 * Chaque page **remplace** la précédente au lieu de s'y concaténer : le DOM
 * reste borné, la carte ne s'allonge pas indéfiniment.
 *
 * `filters` doit être une référence stable (state du parent), sans quoi chaque
 * rendu relancerait un chargement complet.
 */
export function useNewsletterLogs(filters: LogFilters, autoRefresh: boolean) {
    const [lines, setLines] = useState<ApiLogLine[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // Une page pleine signifie « il y a probablement une suite » : le service
    // ne renvoie pas de total, par construction.
    const [hasNext, setHasNext] = useState(false)

    /**
     * Curseurs des pages précédentes. Longueur = index de la page courante,
     * donc `[]` signifie « première page » et pilote l'état du bouton Précédent.
     */
    const [cursorStack, setCursorStack] = useState<number[]>([])

    const abortRef = useRef<AbortController | null>(null)

    const load = useCallback(
        async (beforeId: number | null, showSpinner: boolean) => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            // Un rafraîchissement automatique ne doit pas faire clignoter la
            // liste en squelette sous les yeux de l'utilisateur.
            if (showSpinner) setLoading(true)
            try {
                const data = await fetchApiLogs(
                    filters,
                    LOGS_PAGE_SIZE,
                    beforeId,
                    controller.signal
                )
                if (controller.signal.aborted) return
                setLines(data)
                setHasNext(data.length === LOGS_PAGE_SIZE)
                setError(null)
            } catch (e: unknown) {
                if (controller.signal.aborted) return
                setError(e instanceof Error ? e.message : "Erreur inattendue.")
            } finally {
                if (!controller.signal.aborted && showSpinner) setLoading(false)
            }
        },
        [filters]
    )

    // Tout changement de filtre ramène à la première page — rester en page 4
    // d'un jeu de résultats devenu différent n'aurait aucun sens.
    //
    // L'ajustement se fait pendant le rendu (pattern React « adjust state when
    // props change ») plutôt que dans un effet : un effet provoquerait un
    // rendu intermédiaire affichant l'ancienne pagination avec les nouveaux
    // filtres.
    const previousFiltersRef = useRef(filters)
    if (previousFiltersRef.current !== filters) {
        previousFiltersRef.current = filters
        setCursorStack([])
    }

    useEffect(() => {
        load(null, true)
        return () => abortRef.current?.abort()
    }, [load])

    const nextPage = useCallback(() => {
        const oldest = lines[lines.length - 1]
        if (!oldest || !hasNext) return
        setCursorStack(prev => [...prev, oldest.id])
        load(oldest.id, true)
    }, [lines, hasNext, load])

    const previousPage = useCallback(() => {
        if (cursorStack.length === 0) return
        const next = cursorStack.slice(0, -1)
        setCursorStack(next)
        // Le curseur d'une page est celui qui l'a produite : pour revenir en
        // arrière on rejoue celui de la page d'avant (ou null pour la première).
        load(next.length > 0 ? next[next.length - 1] : null, true)
    }, [cursorStack, load])

    /** Recharge la page courante en conservant la position dans la pile. */
    const refresh = useCallback(
        (showSpinner = true) => {
            const current =
                cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : null
            load(current, showSpinner)
        },
        [cursorStack, load]
    )

    // Auto-rafraîchissement, suspendu quand l'onglet est masqué : inutile
    // d'interroger l'API pour une page que personne ne regarde.
    useEffect(() => {
        if (!autoRefresh) return

        const tick = () => {
            if (document.visibilityState === "visible") refresh(false)
        }
        const id = window.setInterval(tick, LOGS_AUTO_REFRESH_MS)
        return () => window.clearInterval(id)
    }, [autoRefresh, refresh])

    return {
        lines,
        loading,
        error,
        hasNext,
        hasPrevious: cursorStack.length > 0,
        pageIndex: cursorStack.length,
        refresh,
        nextPage,
        previousPage,
    }
}
