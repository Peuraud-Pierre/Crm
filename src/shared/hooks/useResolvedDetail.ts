import { useCallback, useEffect, useState } from "react"

interface ResolvedDetailOptions<T> {
    /** Segment `detail` de l'URL : `new`, un identifiant, ou rien. */
    detail: string | undefined
    /** Palier chargé par l'écran. */
    items: readonly T[] | undefined
    /** Le palier est chargé. */
    loaded: boolean
    /**
     * Lecture unitaire, `null` si la ressource n'existe pas ou n'est pas
     * visible. Doit être stable (useCallback) : elle est en dépendance.
     */
    fetchOne: (id: string) => Promise<T | null>
}

/**
 * Complète `useDetailDeepLink` pour les écrans chargés par paliers.
 *
 * La garde des liens profonds ne cherche que dans ce qui est en mémoire : un
 * identifiant réel mais plus ancien que le palier courant était nettoyé comme
 * lien mort, et l'URL retombait sur la liste sans rien signaler. C'est ce qui
 * arrivait en passant de la fiche d'une balle à l'expédition d'où elle vient,
 * ou d'une ligne de colisage à sa balle.
 *
 * Ce hook va chercher la ressource manquante AVANT que la garde ne conclue :
 * il retient `loaded` à faux le temps de la lecture, puis sert la ressource
 * trouvée par `find`. Une lecture qui ne trouve rien laisse la garde nettoyer,
 * comme avant.
 *
 * La ressource hors palier est relue à chaque rechargement du palier : une
 * écriture sur la fiche ouverte (qui déclenche ce rechargement) ne laisse pas
 * une version périmée à l'écran.
 */
export function useResolvedDetail<T extends { id: string }>({
    detail,
    items,
    loaded,
    fetchOne,
}: ResolvedDetailOptions<T>) {
    const [resolved, setResolved] = useState<{ id: string; row: T | null } | null>(null)

    const targetId = detail && detail !== "new" ? detail : null
    const inPage = targetId !== null && (items ?? []).some((item) => item.id === targetId)
    const needsFetch = loaded && targetId !== null && !inPage

    useEffect(() => {
        if (!needsFetch || targetId === null) return
        let cancelled = false
        fetchOne(targetId).then(
            (row) => {
                if (!cancelled) setResolved({ id: targetId, row })
            },
            () => {
                if (!cancelled) setResolved({ id: targetId, row: null })
            },
        )
        return () => {
            cancelled = true
        }
        // `items` en dépendance : relire à chaque rechargement du palier.
    }, [needsFetch, targetId, items, fetchOne])

    const pending = needsFetch && resolved?.id !== targetId

    const find = useCallback(
        (id: string): T | null =>
            (items ?? []).find((item) => item.id === id) ??
            (resolved?.id === id ? resolved.row : null),
        [items, resolved],
    )

    return { find, loaded: loaded && !pending }
}
