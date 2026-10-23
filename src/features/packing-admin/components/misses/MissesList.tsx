import { useMemo, useRef, useState } from "react"
import { Bot, TriangleAlert } from "lucide-react"
import { staggerStyle } from "@/shared/lib/motion"
import { Badge } from "@/shared/ui/atoms/badge"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { MISTAKES_WINDOW_DAYS } from "@/features/packing-admin/constants"
import { formatConfidence, formatDateTime } from "@/features/packing-admin/utils/format"
import type { PackingModelMiss } from "@/features/packing-admin/types"

type Filter = "auto" | "all"

/**
 * Les libellés où l'humain a contredit la proposition du modèle.
 *
 * Le filtre par défaut est « classées seules », et ce n'est pas un détail : une
 * proposition corrigée est du travail NORMAL — c'est même ce qui entraîne le
 * modèle. Ce qui mérite un regard, c'est ce qu'il avait tranché sans que personne
 * ne regarde, parce que la garde l'avait laissé passer. Mettre les deux dans la
 * même liste indifférenciée noierait les secondes dans les premières.
 */
export function MissesList({ misses }: { misses: PackingModelMiss[] }) {
    const [filter, setFilter] = useState<Filter>("auto")
    // `TabButtonGroup` sert d'offsetParent à sa pastille glissante : la ref doit
    // être posée sur LUI, sinon la pastille se cale sur un ancêtre quelconque.
    const groupRef = useRef<HTMLDivElement | null>(null)

    const autoCount = useMemo(() => misses.filter((m) => m.was_auto).length, [misses])
    const rows = filter === "auto" ? misses.filter((m) => m.was_auto) : misses

    return (
        <>
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Bot size={15} className="shrink-0 text-primary" aria-hidden />
                    <h3 className="text-sm font-semibold text-foreground">
                        Là où le modèle s'est trompé
                    </h3>
                </div>
                <TabButtonGroup
                    containerRef={groupRef}
                    className="flex gap-1 rounded-lg bg-muted p-0.5"
                >
                    <TabButton
                        id="auto"
                        label={`Classées seules (${autoCount})`}
                        shortLabel={`Seules (${autoCount})`}
                        active={filter}
                        set={(id) => setFilter(id as Filter)}
                    />
                    <TabButton
                        id="all"
                        label={`Toutes (${misses.length})`}
                        shortLabel={`Toutes (${misses.length})`}
                        active={filter}
                        set={(id) => setFilter(id as Filter)}
                    />
                </TabButtonGroup>
            </header>

            <p className="text-xs text-muted-foreground">
                Sur les {MISTAKES_WINDOW_DAYS} derniers jours. « Classée seule » veut dire que la
                confiance dépassait le seuil en vigueur : la ligne est passée sans qu'un humain la
                choisisse, et il a fallu la corriger après coup.
            </p>

            {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    {filter === "auto"
                        ? "Aucune ligne classée seule n'a eu à être corrigée. C'est l'état attendu."
                        : "Aucune proposition contredite sur la période."}
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-border">
                    {rows.map((miss, index) => (
                        <li
                            key={miss.packing_list_ligne_id}
                            style={staggerStyle(index, { step: 20, cap: 280 })}
                            className="animate-in fade-in fill-mode-backwards duration-base ease-emphasized flex flex-col gap-1 py-2 text-xs motion-reduce:animate-none sm:flex-row sm:items-center sm:gap-3"
                        >
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                {miss.was_auto && (
                                    <TriangleAlert
                                        size={12}
                                        className="shrink-0 text-destructive"
                                        aria-label="Classée seule, puis corrigée"
                                    />
                                )}
                                <span className="truncate font-mono text-foreground" title={miss.raw_label_key}>
                                    {miss.raw_label_key}
                                </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="font-mono text-2xs text-muted-foreground">
                                    proposé : {(miss.suggested_category_id ?? "—").slice(0, 8)}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-2xs text-success">
                                    retenu : {miss.category_id.slice(0, 8)}
                                </Badge>
                            </span>
                            <span className="tabular-nums text-muted-foreground sm:w-44 sm:shrink-0 sm:text-right">
                                confiance {formatConfidence(miss.suggested_confidence)} ·{" "}
                                {formatDateTime(miss.created_at)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </>
    )
}
