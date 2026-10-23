import FileCard from "./FileCard"
import { type DriveItem } from "../types"

export default function Grid({
    items,
    selected,
    onToggle,
    onOpen,
    selectedIds,
    onMoveInto,
}: {
    items: DriveItem[]
    selected: Record<string, boolean>
    onToggle: (id: string) => void
    onOpen: (p: DriveItem) => void
    /** Sélection courante : glisser un élément sélectionné emporte toute la sélection. */
    selectedIds?: string[]
    /** Absent = déplacement désactivé (corbeille). */
    onMoveInto?: (ids: string[], folderId: string) => void
}) {
    if (!items.length) {
        return (
            <div className="grid place-items-center rounded-2xl border border-dashed p-10 sm:p-16 text-center text-sm text-muted-foreground">
                Aucun fichier pour le moment.
            </div>
        )
    }

    return (
        <div
            className="
                grid 
                grid-cols-2
                sm:grid-cols-3
                lg:grid-cols-4
                xl:grid-cols-5
                gap-3
                sm:gap-4
                md:gap-5
                w-full
            "
        >
            {items.map((p) => (
                <FileCard
                    key={p.id}
                    item={p}
                    selected={!!selected[p.id]}
                    toggle={() => onToggle(p.id)}
                    openPreview={() => onOpen(p)}
                    dragIds={
                        onMoveInto
                            ? selectedIds?.includes(p.id)
                                ? selectedIds
                                : [p.id]
                            : undefined
                    }
                    onDropInto={
                        onMoveInto && p.isFolder
                            ? (ids) => onMoveInto(ids, p.id)
                            : undefined
                    }
                />
            ))}
        </div>
    )
}
