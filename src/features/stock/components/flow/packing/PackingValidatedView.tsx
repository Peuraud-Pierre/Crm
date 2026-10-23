import { useMemo } from "react"
import { CheckCircle2 } from "lucide-react"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { TruncatedText } from "@/shared/ui/molecules/truncated-text"
import type { PackingListLigne, PackingListSummary } from "@/features/stock/types/packing-list.types"
import { groupByCategory } from "@/features/stock/utils/packingGrouping"
import { formatKg, formatPackages, formatQty } from "./packingFormat"

interface PackingValidatedViewProps {
    summary: PackingListSummary
    lignes: PackingListLigne[]
    categoryName: (id: string | null) => string
}

/**
 * Packing validée : le contenu du conteneur par catégorie retenue, du plus
 * gros lot de colis au plus petit. Les libellés bruts restent visibles sous
 * chaque catégorie — on doit pouvoir retrouver d'où vient un chiffre sans
 * rouvrir la vérification.
 *
 * Le colis est la colonne de référence : c'est la seule grandeur dont toutes
 * les lignes disposent. Les pièces et les kilos ne se mélangent pas, chaque
 * ligne du fichier relevant de l'un ou de l'autre.
 */
export function PackingValidatedView({ summary, lignes, categoryName }: PackingValidatedViewProps) {
    const byCategory = useMemo(() => groupByCategory(lignes), [lignes])

    const validatedLabel = summary.validated_at
        ? new Date(summary.validated_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : null

    return (
        <TooltipProvider delayDuration={200}>
            <section className="flex flex-col gap-3">
                {validatedLabel && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={14} className="text-success" aria-hidden />
                        Vérifiée et validée le {validatedLabel}
                    </p>
                )}

                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                                <th className="px-3 py-2 text-right font-medium">Lignes</th>
                                <th className="px-3 py-2 text-right font-medium">Colis</th>
                                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Pièces</th>
                                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Poids</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {byCategory.map((entry) => (
                                <tr
                                    key={entry.categoryId ?? "none"}
                                    className="transition-colors duration-fast hover:bg-muted/30"
                                >
                                    <td className="max-w-0 px-3 py-2">
                                        <p className="font-medium text-foreground">{categoryName(entry.categoryId)}</p>
                                        {/* Une catégorie peut coiffer une vingtaine de
                                            libellés bruts : c'est la traçabilité du
                                            chiffre, elle doit se lire en entier. */}
                                        <TruncatedText
                                            text={entry.rawLabels.join(" · ")}
                                            className="font-mono text-2xs text-muted-foreground"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">{entry.lignes.length}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {formatPackages(entry.totalPackages)}
                                    </td>
                                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                                        {entry.totalPieces > 0 ? formatQty(entry.totalPieces) : "—"}
                                    </td>
                                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                                        {entry.totalWeightKg > 0 ? formatKg(entry.totalWeightKg) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t border-border bg-muted/40 text-xs font-semibold">
                            <tr>
                                <td className="px-3 py-2">Total</td>
                                <td className="px-3 py-2 text-right tabular-nums">{summary.line_count}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {formatPackages(summary.total_packages)}
                                </td>
                                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                                    {summary.total_pieces > 0 ? formatQty(summary.total_pieces) : "—"}
                                </td>
                                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                                    {summary.total_weight_kg > 0 ? formatKg(summary.total_weight_kg) : "—"}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        </TooltipProvider>
    )
}
