import { Checkbox } from "@/shared/ui/atoms/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { cn } from "@/shared/lib/utils"

import { useDriveDrag } from "@/features/drive/hooks/useDriveDrag"
import type { DriveItem } from "@/features/drive/types"
import {
    fileIcon,
    formatBytes,
    formatLabel,
} from "@/features/drive/utils/fileDisplay"

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
})

function Row({
    item,
    selected,
    onToggle,
    onOpen,
    dragIds,
    onDropInto,
}: {
    item: DriveItem
    selected: boolean
    onToggle: () => void
    onOpen: () => void
    dragIds?: string[]
    onDropInto?: (ids: string[]) => void
}) {
    const { dropActive, dragProps } = useDriveDrag({
        itemId: item.id,
        dragIds,
        onDropInto,
    })
    const Icon = fileIcon(item)
    const size = formatBytes(item.sizeBytes)
    const label = formatLabel(item)

    return (
        <TableRow
            {...dragProps}
            onClick={onOpen}
            className={cn(
                "cursor-pointer",
                selected && "bg-muted/60",
                dropActive && "outline outline-2 outline-primary"
            )}
        >
            <TableCell
                className="w-10"
                onClick={(e) => e.stopPropagation()}
            >
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
                    aria-label={`Sélectionner ${item.title ?? "l'élément"}`}
                />
            </TableCell>
            <TableCell className="min-w-0 font-medium">
                <span className="flex items-center gap-2">
                    <Icon
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <span className="truncate">{item.title}</span>
                </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
                {item.isFolder ? "Dossier" : (label ?? "—")}
            </TableCell>
            {/* Tabulaire : sans quoi les chiffres dansent d'une ligne à l'autre. */}
            <TableCell className="text-right tabular-nums text-muted-foreground">
                {item.isFolder ? "—" : (size ?? "—")}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                {item.createdAt
                    ? dateFormat.format(new Date(item.createdAt))
                    : "—"}
            </TableCell>
        </TableRow>
    )
}

/**
 * Vue liste du Drive. Même contrat que `Grid` : le parent décide de ce que
 * « ouvrir » veut dire, et le glisser-déposer passe par le même hook.
 */
export default function ListView({
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
    onOpen: (item: DriveItem) => void
    selectedIds?: string[]
    onMoveInto?: (ids: string[], folderId: string) => void
}) {
    if (!items.length) {
        return (
            <div className="grid place-items-center rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground sm:p-16">
                Aucun fichier pour le moment.
            </div>
        )
    }

    return (
        // Le tableau défile dans son propre conteneur : la page ne doit jamais
        // partir en scroll horizontal sur mobile.
        <div className="w-full overflow-x-auto rounded-2xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Nom</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Taille</TableHead>
                        <TableHead className="text-right">Ajouté le</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <Row
                            key={item.id}
                            item={item}
                            selected={!!selected[item.id]}
                            onToggle={() => onToggle(item.id)}
                            onOpen={() => onOpen(item)}
                            dragIds={
                                onMoveInto
                                    ? selectedIds?.includes(item.id)
                                        ? selectedIds
                                        : [item.id]
                                    : undefined
                            }
                            onDropInto={
                                onMoveInto && item.isFolder
                                    ? (ids) => onMoveInto(ids, item.id)
                                    : undefined
                            }
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
