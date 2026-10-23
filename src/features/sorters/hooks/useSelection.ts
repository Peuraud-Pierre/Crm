// hooks/useSelection.ts
import { useMemo, useState } from "react"

export function useSelection() {
    const [selected, setSelected] = useState<Record<string, boolean>>({})

    const selectedIds = useMemo(
        () => Object.keys(selected).filter((id) => selected[id]),
        [selected]
    )

    const clear = () => setSelected({})
    const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }))

    return { selected, selectedIds, clear, toggle }
}
