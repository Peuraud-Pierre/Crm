import { useEffect, useState } from "react"

/**
 * Délai d'apparition d'un état de chargement.
 *
 * Sans lui, une conversation servie depuis le cache produit un flash de
 * squelette — plus perturbant que le vide qu'il comble. Même raison que le
 * délai des fallbacks de route (DESIGN_SYSTEM.md §13.8).
 */
const APPEARANCE_DELAY_MS = 180

export function useDelayedLoading(
    loading: boolean,
    delayMs: number = APPEARANCE_DELAY_MS
): boolean {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!loading) {
            // Resync : le chargement s'est terminé avant le délai.
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setVisible(false)
            return
        }

        const timer = window.setTimeout(() => setVisible(true), delayMs)
        return () => window.clearTimeout(timer)
    }, [loading, delayMs])

    return visible
}
