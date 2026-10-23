import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Repeat } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import type { WikiRetentionCell } from "../../types/wiki-analytics.types"

/** Nombre de colonnes de suivi affichées (semaine 0 + 5 semaines de retour). */
const MAX_OFFSET = 5

/**
 * Rétention par cohorte hebdomadaire : chaque ligne est un groupe de lecteurs
 * arrivés la même semaine, chaque colonne le nombre d'entre eux revenus k
 * semaines plus tard. Une diagonale qui s'éteint vite = un wiki consulté une
 * fois puis oublié.
 */
export function RetentionCard({ cells }: { cells: WikiRetentionCell[] }) {
    const { rows, returningRate } = useMemo(() => {
        const byCohort = new Map<string, Map<number, number>>()
        for (const c of cells) {
            const row = byCohort.get(c.cohort_week) ?? new Map<number, number>()
            row.set(c.week_offset, c.readers)
            byCohort.set(c.cohort_week, row)
        }

        const rows = [...byCohort.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([week, offsets]) => ({
                week,
                size: offsets.get(0) ?? 0,
                offsets,
            }))

        // Un chiffre unique en tête : part des lecteurs revenus au moins une
        // semaine après leur première lecture.
        const total = rows.reduce((sum, r) => sum + r.size, 0)
        const returned = rows.reduce(
            (sum, r) =>
                sum +
                Math.max(
                    ...[...r.offsets.entries()]
                        .filter(([offset]) => offset > 0)
                        .map(([, readers]) => readers),
                    0
                ),
            0
        )
        return {
            rows,
            returningRate: total > 0 ? Math.round((returned / total) * 100) : 0,
        }
    }, [cells])

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">
                    Rétention des lecteurs
                </CardTitle>
                {rows.length > 0 && (
                    <span className="text-sm font-semibold tabular-nums">
                        {returningRate} %{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                            reviennent
                        </span>
                    </span>
                )}
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={Repeat}
                        title="Pas encore de cohorte"
                        description="Il faut au moins une semaine de consultations pour mesurer la rétention."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="pb-2 pr-3 text-left font-medium">
                                        Cohorte
                                    </th>
                                    {Array.from(
                                        { length: MAX_OFFSET + 1 },
                                        (_, i) => (
                                            <th
                                                key={i}
                                                className="pb-2 text-center font-medium tabular-nums"
                                            >
                                                S+{i}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.week}>
                                        <td className="whitespace-nowrap py-1 pr-3 text-muted-foreground">
                                            {format(
                                                parseISO(row.week),
                                                "d MMM",
                                                { locale: fr }
                                            )}
                                        </td>
                                        {Array.from(
                                            { length: MAX_OFFSET + 1 },
                                            (_, offset) => {
                                                const readers =
                                                    row.offsets.get(offset)
                                                const ratio =
                                                    row.size > 0 && readers
                                                        ? readers / row.size
                                                        : 0
                                                // L'aplat est translucide : en
                                                // dessous du seuil il reste trop
                                                // clair (thème clair) pour
                                                // porter du texte inversé, donc
                                                // on garde la couleur de texte
                                                // normale.
                                                const solid = ratio >= 0.55
                                                return (
                                                    <td
                                                        key={offset}
                                                        className="p-0.5 text-center"
                                                    >
                                                        <span
                                                            title={
                                                                readers
                                                                    ? `${readers} lecteur(s) — ${Math.round(ratio * 100)} %`
                                                                    : undefined
                                                            }
                                                            className={cn(
                                                                "block rounded py-1 tabular-nums",
                                                                !readers &&
                                                                    "text-muted-foreground/40",
                                                                readers &&
                                                                    (solid
                                                                        ? "text-primary-foreground"
                                                                        : "text-foreground")
                                                            )}
                                                            style={
                                                                readers
                                                                    ? {
                                                                          backgroundColor: `hsl(var(--primary) / ${0.12 + ratio * 0.88})`,
                                                                      }
                                                                    : undefined
                                                            }
                                                        >
                                                            {readers ?? "–"}
                                                        </span>
                                                    </td>
                                                )
                                            }
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
