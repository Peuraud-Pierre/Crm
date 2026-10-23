import { staggerStyle } from "@/shared/lib/motion"
import { Card } from "@/shared/ui/atoms/card"
import { formatDateTime, formatShare } from "@/features/packing-admin/utils/format"
import type { PackingImportRow } from "@/features/packing-admin/types"
import { ImportsBreakdown } from "./ImportsBreakdown"
import { ImportStatusBadge } from "./ImportStatusBadge"

interface ImportsTableProps {
    rows: PackingImportRow[]
    onOpen: (row: PackingImportRow) => void
}

/** Part des lignes que personne n'a eu à trancher sur CET import. */
function untouchedShare(lines: PackingImportRow["lines"]): number | null {
    if (!lines) return null
    const total = lines.dictionary + lines.model + lines.suggested + lines.none
    return total === 0 ? null : (lines.dictionary + lines.model) / total
}

/**
 * Historique des imports : tableau à partir de `md`, cartes en dessous.
 *
 * Motif maison (`UsersTab` de l'administration) : jamais de tableau à défilement
 * horizontal sur un téléphone — on ne lit pas une ligne qu'on doit faire glisser
 * pour voir en entier.
 */
export function ImportsTable({ rows, onOpen }: ImportsTableProps) {
    return (
        <>
            <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">Conteneur</th>
                            <th className="px-3 py-2 text-left font-medium">Importé le</th>
                            <th className="px-3 py-2 text-left font-medium">Statut</th>
                            <th className="px-3 py-2 text-left font-medium">Répartition des lignes</th>
                            <th className="px-3 py-2 text-right font-medium">Sans intervention</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((row, index) => (
                            <tr
                                key={row.id}
                                tabIndex={0}
                                role="button"
                                onClick={() => onOpen(row)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        onOpen(row)
                                    }
                                }}
                                style={staggerStyle(index, { step: 24, cap: 300 })}
                                className="animate-in fade-in fill-mode-backwards duration-base ease-emphasized cursor-pointer transition-colors duration-fast hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:animate-none"
                            >
                                <td className="px-3 py-2">
                                    <p className="font-medium text-foreground">
                                        {row.container_label ?? "Sans titre"}
                                    </p>
                                    <p className="truncate font-mono text-2xs text-muted-foreground">
                                        {row.source_filename ?? "—"}
                                    </p>
                                </td>
                                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                    {formatDateTime(row.imported_at)}
                                </td>
                                <td className="px-3 py-2">
                                    <ImportStatusBadge status={row.status} />
                                </td>
                                <td className="px-3 py-2">
                                    <ImportsBreakdown lines={row.lines} />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {formatShare(untouchedShare(row.lines))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className="flex flex-col gap-2 md:hidden">
                {rows.map((row, index) => (
                    <li key={row.id} style={staggerStyle(index, { step: 24, cap: 300 })}>
                        <Card
                            variant="interactive"
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpen(row)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    onOpen(row)
                                }
                            }}
                            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-base ease-emphasized flex flex-col gap-2 p-3 motion-reduce:animate-none"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">
                                        {row.container_label ?? "Sans titre"}
                                    </p>
                                    <p className="text-2xs tabular-nums text-muted-foreground">
                                        {formatDateTime(row.imported_at)}
                                    </p>
                                </div>
                                <ImportStatusBadge status={row.status} />
                            </div>
                            <ImportsBreakdown lines={row.lines} />
                            <p className="text-2xs tabular-nums text-muted-foreground">
                                {formatShare(untouchedShare(row.lines))} sans intervention
                            </p>
                        </Card>
                    </li>
                ))}
            </ul>
        </>
    )
}
