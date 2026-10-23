import { useCallback, useMemo } from "react"
import { chartColor } from "@/shared/lib/chartPalette"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { formatKg, kgParSortie } from "@/features/salle-de-tri/utils/triAnalytics"
import type { FicheTriBalle } from "@/features/salle-de-tri/types/tri.types"

/**
 * Couleur d'un type de sortie, STABLE d'un écran à l'autre : elle dépend de
 * sa place dans le référentiel (ordre), pas de sa place dans une liste
 * filtrée. MAG reste de la même couleur dans la fiche, le tableau et les
 * graphiques.
 */
export function useSortieColor() {
    const { sorties } = useTriContext()
    const index = useMemo(() => new Map(sorties.map((s, i) => [s.id, i])), [sorties])
    return useCallback((sortieId: string) => chartColor(index.get(sortieId) ?? 7), [index])
}

/**
 * Barre empilée des kilos répartis par type de sortie, avec sa légende.
 * `compact` : la barre seule, fine, pour une carte (le détail est au survol).
 */
export function RepartitionBar({ balles, compact = false }: { balles: readonly FicheTriBalle[]; compact?: boolean }) {
    const { sortieById } = useTriContext()
    const color = useSortieColor()

    const parts = useMemo(() => {
        const kg = kgParSortie(balles)
        const total = [...kg.values()].reduce((s, v) => s + v, 0)
        return [...kg]
            .map(([id, value]) => ({ id, value, pct: total > 0 ? (value / total) * 100 : 0 }))
            .sort((a, b) => b.value - a.value)
    }, [balles])

    if (parts.length === 0) return compact
        ? <div className="h-1.5 w-full rounded-full bg-muted" aria-label="Aucun kilo réparti" />
        : <p className="text-sm text-muted-foreground">Aucun kilo réparti.</p>

    if (compact) {
        return (
            <div
                className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={parts.map((p) => `${sortieById.get(p.id)?.code ?? "?"} ${formatKg(p.value)}`).join(", ")}
                title={parts.map((p) => `${sortieById.get(p.id)?.code ?? "?"} ${formatKg(p.value)}`).join(" · ")}
            >
                {parts.map((p) => <div key={p.id} style={{ width: `${p.pct}%`, backgroundColor: color(p.id) }} />)}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Répartition des kilos par type de sortie">
                {parts.map((p) => (
                    // Largeur = donnée : posée en style inline, pas en classe.
                    <div key={p.id} style={{ width: `${p.pct}%`, backgroundColor: color(p.id) }} />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {parts.map((p) => (
                    <li key={p.id} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color(p.id) }} aria-hidden />
                        <span className="font-mono font-semibold">{sortieById.get(p.id)?.code ?? "?"}</span>
                        <span className="tabular-nums text-muted-foreground">
                            {formatKg(p.value)} · {Math.round(p.pct)} %
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
