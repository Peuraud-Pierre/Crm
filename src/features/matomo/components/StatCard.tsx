import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { InfoTooltip } from "@/shared/ui/molecules/info-tooltip"
import type { CompareLabel, Delta, Tone } from "../utils/comparison"

/** Couleur = bon ou mauvais sens pour CE KPI. Jamais seule : signe, flèche et texte portent aussi le sens. */
const TONE: Record<Tone, string> = {
    good: "text-success",
    bad: "text-destructive",
    flat: "text-muted-foreground",
    none: "text-muted-foreground",
}

function spokenDelta(delta: Delta, label: CompareLabel) {
    if (delta.tone === "none") return "Aucune donnée sur la période précédente."
    if (!delta.direction) return `Stable par rapport ${label.spoken}.`
    const amount = delta.text.replace(/^[+−]/, "")
    return `En ${delta.direction === "up" ? "hausse" : "baisse"} de ${amount} par rapport ${label.spoken}.`
}

export interface StatComparison {
    delta: Delta | null
    label: CompareLabel
    /** Dates de la période de référence, en clair (« 6 août → 4 sept. 2026 »). */
    span?: string
    loading: boolean
}

export default function StatCard({
    label,
    value,
    hint,
    loading = false,
    comparison,
}: {
    label: string
    /** Définition de l'indicateur, en pastille d'aide à côté du libellé. */
    hint?: string
    value: string | number
    loading?: boolean
    /** Écart avec la période précédente ; absent quand la vue n'est pas comparable. */
    comparison?: StatComparison
}) {
    const delta = comparison?.delta
    const Arrow = delta?.direction === "down" ? ArrowDownRight : ArrowUpRight

    // Cellule nue : la grille parente porte déjà la surface. Une carte par KPI
    // empilait des cartes dans une carte.
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <dt className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{label}</span>
                {hint && <InfoTooltip content={hint} size={12} />}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums tracking-tight">
                {/* Squelette à la hauteur de la valeur (h-8 = interligne de
                    text-2xl) : rien ne saute quand le chiffre arrive. */}
                {loading ? <Skeleton className="h-8 w-20" /> : value}
            </dd>
            {comparison && (
                // Erreur ou donnée manquante : la ligne disparaît, sans erreur
                // affichée. La comparaison est secondaire, le KPI reste juste.
                <dd className="min-h-4 text-xs">
                    {comparison.loading ? (
                        <Skeleton className="h-4 w-28" />
                    ) : (
                        delta && (
                            <>
                                <span
                                    aria-hidden
                                    // Les dates exactes de la référence, au survol.
                                    title={comparison.span && `Période de référence : ${comparison.span}`}
                                    className="inline-flex flex-wrap items-center gap-x-1"
                                >
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-0.5 font-medium tabular-nums",
                                            TONE[delta.tone]
                                        )}
                                    >
                                        {delta.direction && <Arrow className="size-3.5" />}
                                        {delta.text}
                                    </span>
                                    {delta.tone !== "none" && (
                                        <span className="text-muted-foreground">
                                            {comparison.label.short}
                                        </span>
                                    )}
                                </span>
                                <span className="sr-only">
                                    {spokenDelta(delta, comparison.label)}
                                    {comparison.span && ` (${comparison.span})`}
                                </span>
                            </>
                        )
                    )}
                </dd>
            )}
        </div>
    )
}
