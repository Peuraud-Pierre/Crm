import type { ReactNode } from "react"
import { BookCheck, ChevronDown } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"

interface PackingDictionaryStrataProps {
    groups: PackingGroup[]
    open: boolean
    onToggle: () => void
    renderCard: (group: PackingGroup, index: number) => ReactNode
}

/**
 * Ce dont l'utilisateur est dispensé : les libellés que le tableau de
 * correspondance a reconnus, parce qu'ils ont déjà été validés sur un conteneur
 * précédent.
 *
 * Repliée par défaut, et c'est le point : déployer 47 cartes acquises noierait
 * les 74 qui restent à trancher. Leur intérêt est d'être COMPTÉS comme acquis,
 * pas d'être relus.
 */
export function PackingDictionaryStrata({
    groups,
    open,
    onToggle,
    renderCard,
}: PackingDictionaryStrataProps) {
    const labels = groups.length
    const lines = groups.reduce((sum, g) => sum + g.lignes.length, 0)
    const s = labels > 1 ? "s" : ""

    return (
        <div className="rounded-xl border border-border bg-success-light/40">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors duration-fast hover:bg-success-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <BookCheck size={14} className="shrink-0 text-success" aria-hidden />
                <span className="min-w-0 flex-1 text-xs">
                    <span className="font-medium text-foreground">
                        {labels} libellé{s} reconnu{s}
                    </span>{" "}
                    {/* « Vous les avez validés » et non « déjà validés » : ces
                        libellés sont dispensés PARCE QUE quelqu'un les a
                        tranchés au conteneur précédent. C'est le seul endroit où
                        le travail passé se voit rapporter ce qu'il a évité. */}
                    <span className="tabular-nums text-muted-foreground">
                        ({lines} ligne{lines > 1 ? "s" : ""}) — vous {labels > 1 ? "les" : "l'"}avez
                        validé{s} sur un conteneur précédent, rien à revérifier.
                    </span>
                </span>
                <ChevronDown
                    size={14}
                    className={cn(
                        "shrink-0 transition-transform duration-base ease-emphasized",
                        open && "rotate-180",
                    )}
                    aria-hidden
                />
            </button>
            {open && (
                <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
                    {groups.map(renderCard)}
                </div>
            )}
        </div>
    )
}
