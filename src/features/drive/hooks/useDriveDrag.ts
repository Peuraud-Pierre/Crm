import { useState } from "react"

import { DRIVE_DRAG_TYPE } from "@/features/drive/types"

/**
 * Glisser-déposer d'éléments du Drive, partagé par la vue grille et la vue
 * liste : deux implémentations divergeraient à la première correction.
 *
 * @param itemId élément portant ces props, exclu d'un dépôt sur lui-même.
 * @param dragIds éléments transportés au départ de cet élément. Vide ou absent
 *   = non déplaçable.
 * @param onDropInto reçoit les éléments déposés. Absent = non déposable.
 */
export function useDriveDrag({
    itemId,
    dragIds,
    onDropInto,
}: {
    itemId: string
    dragIds?: string[]
    onDropInto?: (ids: string[]) => void
}) {
    const [dropActive, setDropActive] = useState(false)

    const draggable = !!dragIds?.length

    return {
        dropActive,
        dragProps: {
            draggable,
            onDragStart: (e: React.DragEvent) => {
                if (!dragIds?.length) return
                e.dataTransfer.setData(DRIVE_DRAG_TYPE, JSON.stringify(dragIds))
                e.dataTransfer.effectAllowed = "move"
            },
            onDragOver: (e: React.DragEvent) => {
                // Sans preventDefault, le navigateur refuse le dépôt.
                if (
                    !onDropInto ||
                    !e.dataTransfer.types.includes(DRIVE_DRAG_TYPE)
                )
                    return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setDropActive(true)
            },
            onDragLeave: () => setDropActive(false),
            onDrop: (e: React.DragEvent) => {
                setDropActive(false)
                if (!onDropInto) return
                const raw = e.dataTransfer.getData(DRIVE_DRAG_TYPE)
                if (!raw) return
                e.preventDefault()
                // Stoppé ici : sinon la zone de dépôt de la page interpréterait
                // le même événement.
                e.stopPropagation()
                try {
                    const ids = (JSON.parse(raw) as string[]).filter(
                        (id) => id !== itemId
                    )
                    if (ids.length) onDropInto(ids)
                } catch {
                    // Charge utile illisible : un glisser venu d'ailleurs.
                }
            },
        },
    }
}
