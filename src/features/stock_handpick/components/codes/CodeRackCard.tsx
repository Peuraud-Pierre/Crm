import { Check } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { rackGrid, type CodeGroup, type CodeItem } from "@/features/stock_handpick/utils/emplacementGroups"

interface CodeRackCardProps {
    group: CodeGroup
    selected: ReadonlySet<string>
    onToggle: (ids: string[], on: boolean) => void
}

const cellClass = (on: boolean) =>
    cn(
        "flex h-10 w-full items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors duration-base",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
    )

/**
 * Un rack à étiqueter, dessiné comme le rack réel : travées en colonnes,
 * hauteurs de haut (H2) en bas (H0). Une case = un emplacement ; cliquer
 * l'en-tête d'une travée la coche entière. Une zone sans rack (A · SOL) est
 * une simple rangée de boutons.
 */
export function CodeRackCard({ group, selected, onToggle }: CodeRackCardProps) {
    const ids = group.items.map((item) => item.id)
    const count = ids.filter((id) => selected.has(id)).length
    const all = count === ids.length
    const grid = rackGrid(group)

    const cell = (item: CodeItem, text: string) => {
        const on = selected.has(item.id)
        return (
            <button
                key={item.id}
                type="button"
                aria-pressed={on}
                aria-label={item.path}
                title={item.path}
                onClick={() => onToggle([item.id], !on)}
                className={cellClass(on)}
            >
                {on ? <Check size={16} aria-hidden /> : text}
            </button>
        )
    }

    return (
        <section
            aria-label={`${group.label} — ${group.subtitle}`}
            className={cn(
                "space-y-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors duration-base",
                count > 0 ? "border-primary/40" : "border-border",
            )}
        >
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="font-mono text-lg font-bold text-foreground">{group.label}</h4>
                    <p className="truncate text-sm text-muted-foreground">{group.subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={count > 0 ? "default" : "secondary"} className="tabular-nums">
                        {count}/{ids.length}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => onToggle(ids, !all)}>
                        {all ? "Aucun" : "Tout"}
                    </Button>
                </div>
            </header>

            {grid ? (
                <table className="w-full table-fixed border-separate border-spacing-1">
                    <thead>
                        <tr>
                            <th scope="col" className="w-10" aria-label="Hauteur" />
                            {grid.bays.map((bay) => {
                                const bayIds = grid.levels
                                    .map((level) => grid.cells.get(`${bay}/${level}`)?.id)
                                    .filter((id): id is string => Boolean(id))
                                const bayAll = bayIds.every((id) => selected.has(id))
                                return (
                                    <th key={bay} scope="col">
                                        <button
                                            type="button"
                                            onClick={() => onToggle(bayIds, !bayAll)}
                                            className="w-full rounded-md py-1 font-mono text-sm font-semibold text-muted-foreground transition-colors duration-base hover:bg-muted hover:text-foreground"
                                            aria-label={`${bayAll ? "Décocher" : "Cocher"} la travée ${bay}`}
                                        >
                                            {bay}
                                        </button>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {grid.levels.map((level) => (
                            <tr key={level}>
                                <th scope="row" className="pr-1 text-left font-mono text-sm font-semibold text-muted-foreground">
                                    {level}
                                </th>
                                {grid.bays.map((bay) => {
                                    const item = grid.cells.get(`${bay}/${level}`)
                                    return (
                                        <td key={bay}>
                                            {item ? (
                                                cell(item, level)
                                            ) : (
                                                // Palette au sol (H0 seul) ou emplacement retiré.
                                                <span aria-hidden className="block h-10 rounded-lg border border-dashed border-border/60" />
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.items.map((item) => cell(item, item.segments.slice(1).join(" · ")))}
                </div>
            )}
        </section>
    )
}
