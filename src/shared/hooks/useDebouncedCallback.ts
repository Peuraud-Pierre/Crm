import { useCallback, useEffect, useRef } from "react"

/**
 * Regroupe une rafale d'appels en un seul, `delay` ms après le dernier.
 *
 * Un enregistrement de fiche ou une expédition déclenche plusieurs
 * événements realtime (en-tête, lignes, cartons…) : sans regroupement,
 * chacun relancerait le même rechargement.
 */
export function useDebouncedCallback(callback: () => void, delay = 300): () => void {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const callbackRef = useRef(callback)
    callbackRef.current = callback

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current)
    }, [])

    return useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => callbackRef.current(), delay)
    }, [delay])
}
