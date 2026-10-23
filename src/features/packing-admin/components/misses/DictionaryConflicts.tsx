import { BookCheck } from "lucide-react"
import { staggerStyle } from "@/shared/lib/motion"
import { Badge } from "@/shared/ui/atoms/badge"
import { formatDateTime } from "@/features/packing-admin/utils/format"
import type { PackingDictionaryConflict } from "@/features/packing-admin/types"

/**
 * Correspondances apprises qu'une décision humaine plus récente contredit.
 *
 * Le panneau qui compte le plus dans la durée. Le tableau ne reconnaît que des
 * libellés identiques : une erreur apprise une fois se réapplique telle quelle
 * sur tous les conteneurs suivants, silencieusement, et rien d'autre ne la
 * signale. `hit_count` dit combien de fois elle a déjà servi — c'est la mesure
 * du dégât, pas une statistique.
 *
 * Les identifiants de catégorie sont affichés bruts : la console ne charge pas le
 * référentiel du stock (elle n'en est pas propriétaire), et la correction se fait
 * de toute façon dans Stock → Paramètres → Correspondances, où les noms sont là.
 */
export function DictionaryConflicts({ conflicts }: { conflicts: PackingDictionaryConflict[] }) {
    if (conflicts.length === 0) {
        return (
            <>
                <Header count={0} />
                <p className="text-xs text-muted-foreground">
                    Aucune correspondance en désaccord avec une décision plus récente.
                </p>
            </>
        )
    }

    return (
        <>
            <Header count={conflicts.length} />
            <p className="text-xs text-muted-foreground">
                Une décision plus récente dit autre chose que le tableau. Tant qu'elle n'est pas
                reprise dans Stock → Paramètres → Correspondances, la même erreur se répétera sur
                chaque conteneur qui porte ce libellé.
            </p>
            <ul className="flex flex-col divide-y divide-border">
                {conflicts.map((conflict, index) => (
                    <li
                        key={conflict.raw_label_key}
                        style={staggerStyle(index, { step: 24, cap: 300 })}
                        className="animate-in fade-in fill-mode-backwards duration-base ease-emphasized flex flex-col gap-1 py-2 text-xs motion-reduce:animate-none sm:flex-row sm:items-center sm:gap-3"
                    >
                        <span
                            className="min-w-0 flex-1 truncate font-mono text-foreground"
                            title={conflict.raw_label_sample}
                        >
                            « {conflict.raw_label_sample} »
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="font-mono text-2xs text-muted-foreground">
                                tableau : {conflict.dictionary_category_id.slice(0, 8)}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-2xs text-warning">
                                humain : {conflict.latest_human_category_id.slice(0, 8)}
                            </Badge>
                        </span>
                        <span className="tabular-nums text-muted-foreground sm:w-48 sm:shrink-0 sm:text-right">
                            {conflict.hit_count} usage(s) · {formatDateTime(conflict.latest_decision_at)}
                        </span>
                    </li>
                ))}
            </ul>
        </>
    )
}

function Header({ count }: { count: number }) {
    return (
        <header className="flex items-center gap-2">
            <BookCheck size={15} className="shrink-0 text-warning" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">
                Correspondances contredites{count > 0 && ` (${count})`}
            </h3>
        </header>
    )
}
