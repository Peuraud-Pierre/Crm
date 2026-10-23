import { Layers, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import {
    PLAN_ZONES,
    shelfLevelKey,
    shelfLevels,
    type PlanIndex,
    type PlanSelection,
} from "@/features/stock_handpick/utils/planLayout"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { BalleChip } from "./BalleChip"

interface PlanDetailPanelProps {
    selection: PlanSelection
    index: PlanIndex
    ballesIn: (ids: readonly (string | undefined)[]) => BalleHandpick[]
    pathFor: (emplacementId: string | null | undefined) => string | null
    onClose: () => void
    onOpenBalle: (id: string) => void
}

interface Row {
    key: string
    label: string
    /** `false` : l'emplacement du dessin n'existe pas en base. */
    exists: boolean
    balles: BalleHandpick[]
}

/**
 * Contenu de la sélection. Une étagère se lit de haut en bas, H2 → H0, comme
 * la vue de face du tableau ; une zone liste ses emplacements.
 */
export function PlanDetailPanel({
    selection,
    index,
    ballesIn,
    pathFor,
    onClose,
    onOpenBalle,
}: PlanDetailPanelProps) {
    let title: string
    let rows: Row[]

    if (selection.kind === "shelf") {
        title = `B · ${selection.row} · ${selection.shelf}`
        rows = shelfLevels(selection.row, selection.shelf).map((level) => {
            const id = index.byPath.get(shelfLevelKey(selection.row, selection.shelf, level))
            return { key: level, label: level, exists: Boolean(id), balles: ballesIn([id]) }
        })
    } else {
        title = `${selection.zone} (${PLAN_ZONES[selection.zone].label})`
        rows = (index.byZone.get(selection.zone) ?? [])
            .map((id) => ({
                key: id,
                label: pathFor(id) ?? id.slice(0, UUID_DISPLAY_LENGTH),
                exists: true,
                balles: ballesIn([id]),
            }))
            .sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }))
    }

    const total = rows.reduce((sum, row) => sum + row.balles.length, 0)

    return (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-base">
            <div className="flex items-center gap-2">
                <Layers size={16} className="text-muted-foreground" aria-hidden />
                <h3 className="font-mono text-base font-bold text-foreground">{title}</h3>
                <span className="text-xs text-muted-foreground">
                    {total} balle{total > 1 ? "s" : ""}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7"
                    onClick={onClose}
                    aria-label="Fermer le détail"
                >
                    <X size={14} />
                </Button>
            </div>

            {rows.length === 0 ? (
                <p className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>
                    Aucun emplacement dans cette zone.
                </p>
            ) : (
                <ul className="space-y-2">
                    {rows.map((row) => (
                        <li
                            key={row.key}
                            className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2 sm:flex-row sm:items-start"
                        >
                            <span className="w-full shrink-0 font-mono text-sm font-bold text-foreground sm:w-28">
                                {row.label}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                {!row.exists ? (
                                    <span className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>
                                        Emplacement non créé
                                    </span>
                                ) : row.balles.length === 0 ? (
                                    <span className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>
                                        Vide
                                    </span>
                                ) : (
                                    row.balles.map((balle) => (
                                        <BalleChip key={balle.id} balle={balle} onOpen={onOpenBalle} />
                                    ))
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
