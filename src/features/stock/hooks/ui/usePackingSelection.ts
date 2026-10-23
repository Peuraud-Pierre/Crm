import { useCallback, useMemo, useRef, useState } from "react"

/**
 * Sélection multiple de libellés dans la strate « à classer ».
 *
 * Écrite ici et non promue dans `shared/` : `features/sorters/hooks/useSelection`
 * existe déjà, mais ne couvre ni la plage Maj-clic, ni « tout ce qui est
 * visible », ni un compteur. L'élargir obligerait à retoucher `sorters` pour un
 * contrat que deux features ne partagent pas — le design system demande un
 * besoin de réutilisation AVÉRÉ, pas anticipé.
 *
 * Mesuré sur les deux packings réelles, le geste a de quoi servir : sur GR154,
 * 121 libellés sur 121 partagent un jeton avec un autre, et « jacket » en
 * rassemble 39 à lui seul. Combiné au tri par libellé, cocher une famille et
 * lui donner une catégorie d'un coup remplace autant de décisions séparées.
 *
 * La règle de sûreté est le nettoyage : une clé qui quitte la liste
 * sélectionnable (classée par un autre chemin, masquée par une recherche) sort
 * de la sélection. Sans ça, une case cochée invisible ferait écrire sur un
 * libellé que personne ne regarde. Ce nettoyage est **dérivé du rendu** et non
 * posé par un effet : un effet qui écrit l'état à chaque changement de liste
 * ajoute un rendu et une cascade pour un résultat qu'un calcul donne tout de
 * suite.
 */

export interface PackingSelection {
    selected: ReadonlySet<string>
    count: number
    /**
     * Coche ou décoche. `extend` (Maj-clic) coche tout ce qui sépare la
     * dernière case cochée de celle-ci, dans l'ordre affiché.
     */
    toggle: (key: string, extend?: boolean) => void
    selectAll: () => void
    clear: () => void
}

export function usePackingSelection(selectableKeys: readonly string[]): PackingSelection {
    const [raw, setRaw] = useState<ReadonlySet<string>>(() => new Set())
    /** Dernière case cochée, origine d'une plage Maj-clic. */
    const anchorRef = useRef<string | null>(null)

    // Signature stable : sans elle, la liste serait recalculée à chaque rendu
    // du panneau, qui recrée son tableau de clés.
    const signature = selectableKeys.join("\u0000")
    const keys = useMemo(() => (signature === "" ? [] : signature.split("\u0000")), [signature])

    /**
     * L'état brut peut garder une clé qui a quitté l'écran ; elle n'est jamais
     * exposée ici, et le premier geste la purge (voir `toggle`).
     */
    const selected = useMemo(() => {
        const available = new Set(keys)
        return new Set([...raw].filter((key) => available.has(key)))
    }, [raw, keys])

    const toggle = useCallback(
        (key: string, extend = false) => {
            const anchor = anchorRef.current
            setRaw((current) => {
                const available = new Set(keys)
                const next = new Set([...current].filter((k) => available.has(k)))
                const from = anchor === null ? -1 : keys.indexOf(anchor)
                const to = keys.indexOf(key)

                if (extend && from !== -1 && to !== -1) {
                    const [start, end] = from <= to ? [from, to] : [to, from]
                    for (const inRange of keys.slice(start, end + 1)) next.add(inRange)
                } else if (next.has(key)) {
                    next.delete(key)
                } else {
                    next.add(key)
                }
                return next
            })
            anchorRef.current = key
        },
        [keys],
    )

    return {
        selected,
        count: selected.size,
        toggle,
        selectAll: useCallback(() => setRaw(new Set(keys)), [keys]),
        clear: useCallback(() => {
            anchorRef.current = null
            setRaw(new Set())
        }, []),
    }
}
