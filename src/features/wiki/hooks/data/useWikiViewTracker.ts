import { useEffect, useRef, type RefObject } from "react"
import { wikiAnalyticsService } from "../../services/wikiAnalyticsService"
import { WIKI_COMPLETION_SCROLL_RATIO } from "../../constants"
import type { WikiViewSource } from "../../types/wiki-analytics.types"

/**
 * Trace la consultation d'un article : une ligne est insérée à l'ouverture
 * (c'est le « clic »), puis complétée à la sortie par le temps passé et
 * l'atteinte du bas de page (c'est la « lecture »).
 *
 * L'écart entre les deux est ce qui rend la mesure exploitable : un article
 * très ouvert mais toujours refermé en trois secondes n'a pas le même
 * problème qu'un article jamais ouvert.
 *
 * @param articleId  article affiché, `null` si aucun
 * @param source     point d'entrée de l'ouverture
 * @param scrollRef  conteneur défilant de l'article, pour détecter la fin de lecture
 */
export function useWikiViewTracker(
    articleId: string | null,
    source: WikiViewSource,
    scrollRef: RefObject<HTMLElement | null>
) {
    // `source` ne doit pas relancer l'effet : seule l'ouverture compte.
    const sourceRef = useRef(source)
    sourceRef.current = source
    const completedRef = useRef(false)

    useEffect(() => {
        if (!articleId) return

        const openedAt = Date.now()
        completedRef.current = false
        let viewId: string | null = null
        let flushed = false
        // L'article peut être refermé avant que l'insert ne réponde (rebond
        // rapide) : on mémorise la demande pour la rejouer à l'arrivée de l'id,
        // sinon ces consultations resteraient sans temps de lecture.
        let flushPending = false

        const el = scrollRef.current
        const onScroll = () => {
            if (!el || completedRef.current) return
            const reachedEnd =
                el.scrollHeight <= el.clientHeight ||
                el.scrollTop + el.clientHeight >=
                    el.scrollHeight * WIKI_COMPLETION_SCROLL_RATIO
            if (reachedEnd) completedRef.current = true
        }
        // Un article plus court que la fenêtre est lu sans défilement.
        onScroll()
        el?.addEventListener("scroll", onScroll, { passive: true })

        const flush = () => {
            if (flushed) return
            if (!viewId) {
                flushPending = true
                return
            }
            flushed = true
            wikiAnalyticsService
                .patchView(viewId, {
                    dwell_ms: Date.now() - openedAt,
                    completed: completedRef.current,
                })
                .catch(() => {})
        }

        // La télémétrie ne doit jamais interrompre la lecture : tout échec est
        // avalé (hors ligne, RLS, article supprimé entre-temps).
        wikiAnalyticsService
            .recordView(articleId, sourceRef.current)
            .then((id) => {
                viewId = id
                if (flushPending) flush()
            })
            .catch(() => {})

        // L'onglet fermé/masqué ne déclenche pas de démontage : on profite du
        // dernier instant où la page est encore vivante.
        const onVisibility = () => {
            if (document.visibilityState === "hidden") flush()
        }
        document.addEventListener("visibilitychange", onVisibility)

        return () => {
            el?.removeEventListener("scroll", onScroll)
            document.removeEventListener("visibilitychange", onVisibility)
            flush()
        }
    }, [articleId, scrollRef])
}
