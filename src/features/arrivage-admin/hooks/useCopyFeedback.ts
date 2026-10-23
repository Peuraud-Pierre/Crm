import { useCallback, useEffect, useRef, useState } from "react"

/** Durée d'affichage du retour « copié » sur le bouton (ms). */
const COPIED_FEEDBACK_MS = 2000

/**
 * Copie dans le presse-papier avec retour visuel temporaire, indexé par un
 * identifiant pour qu'une liste puisse n'illuminer que la ligne copiée.
 *
 * Extrait de `useCodeVisibility` : les codes d'invitation et les lignes de log
 * partagent ce comportement, seul le masquage est propre aux codes.
 */
export function useCopyFeedback() {
    const [copiedIds, setCopiedIds] = useState<Set<string>>(() => new Set())

    // Les timers doivent être annulés au démontage, sinon un setState arrive
    // sur un composant disparu.
    const timersRef = useRef<number[]>([])
    useEffect(
        () => () => {
            timersRef.current.forEach(window.clearTimeout)
        },
        []
    )

    const isCopied = useCallback((id: string) => copiedIds.has(id), [copiedIds])

    const copy = useCallback(async (id: string, text: string) => {
        await navigator.clipboard.writeText(text)
        setCopiedIds(prev => new Set(prev).add(id))
        const timer = window.setTimeout(() => {
            setCopiedIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }, COPIED_FEEDBACK_MS)
        timersRef.current.push(timer)
    }, [])

    return { isCopied, copy }
}
