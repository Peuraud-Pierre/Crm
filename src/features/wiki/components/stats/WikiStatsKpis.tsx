import {
    BookOpenCheck,
    Eye,
    Hourglass,
    Layers,
    LogOut,
    Users,
} from "lucide-react"
import { KpiCard } from "@/features/stock/components/dashboard/KpiCard"
import type { WikiStatsOverview } from "../../types/wiki-analytics.types"

/** Formate une durée en secondes de façon lisible (42 s, 3 min 20 s). */
function formatDwell(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)} s`
    const min = Math.floor(seconds / 60)
    const rest = Math.round(seconds % 60)
    return rest ? `${min} min ${rest} s` : `${min} min`
}

/**
 * Les six chiffres qui répondent à « le wiki sert-il ? » : le volume (vues,
 * lecteurs), l'étendue (couverture du catalogue) et la qualité de la lecture
 * (temps passé, complétion, rebond).
 */
export function WikiStatsKpis({
    overview,
}: {
    overview: WikiStatsOverview | null
}) {
    const o = overview

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
                title="Consultations"
                value={o?.views ?? 0}
                hint="Ouvertures d'articles sur la période"
                icon={<Eye className="h-4 w-4" />}
            />
            <KpiCard
                title="Lecteurs uniques"
                value={o?.unique_readers ?? 0}
                hint="Personnes distinctes"
                icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
                title="Couverture du wiki"
                value={`${o?.coverage_rate ?? 0} %`}
                hint={`${o?.articles_viewed ?? 0} / ${o?.articles_published ?? 0} articles publiés lus`}
                icon={<Layers className="h-4 w-4" />}
            />
            <KpiCard
                title="Temps de lecture moyen"
                value={formatDwell(o?.avg_dwell_seconds ?? 0)}
                hint="Par consultation"
                icon={<Hourglass className="h-4 w-4" />}
            />
            <KpiCard
                title="Lectures terminées"
                value={`${o?.completion_rate ?? 0} %`}
                hint="Article parcouru jusqu'au bas"
                icon={<BookOpenCheck className="h-4 w-4" />}
            />
            <KpiCard
                title="Rebond"
                value={`${o?.bounce_rate ?? 0} %`}
                hint="Refermé en moins de 5 secondes"
                icon={<LogOut className="h-4 w-4" />}
                // Au-delà d'un tiers, l'article trouvé ne répond pas à ce qui
                // était cherché : c'est le signal à corriger en priorité.
                variant={(o?.bounce_rate ?? 0) > 33 ? "warning" : "default"}
            />
        </div>
    )
}
