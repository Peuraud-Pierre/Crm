import { useEffect, useRef, useState } from "react"

// Renvoie `true` brièvement lorsque `value` change, pour déclencher une
// animation de surbrillance (classe CSS `highlight-change`). Hérité de
// l'ancienne feature `gestion` ; réimplémenté localement dans sorters.
export function useHighlightOnChange(
    value: string | number | null | undefined
): boolean {
    const [changed, setChanged] = useState(false)
    const previousRef = useRef(value)

    useEffect(() => {
        if (previousRef.current === value) return
        previousRef.current = value
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- surbrillance transitoire déclenchée par un changement de valeur externe : effet de bord assumé
        setChanged(true)
        const timeout = setTimeout(() => setChanged(false), 1000)
        return () => clearTimeout(timeout)
    }, [value])

    return changed
}
