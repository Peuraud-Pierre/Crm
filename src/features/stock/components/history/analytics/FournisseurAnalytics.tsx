import { useMemo } from "react"
import { Building2, MoonStar, Package, Weight } from "lucide-react"
import { StatTile } from "@/shared/components/misc/StatTile"
import {
    useArrivageManuelContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import {
    computeFournisseurAnalytics,
    formatTonnage,
    inactiveFournisseurs,
} from "@/features/stock/utils/fournisseurAnalytics"
import { TopFournisseursChart } from "./TopFournisseursChart"
import { ArrivageStatusChart } from "./ArrivageStatusChart"
import { InactiveFournisseursCard } from "./InactiveFournisseursCard"

interface FournisseurAnalyticsProps {
    /** Bornes du filtre de période de l'historique, format "YYYY-MM-DD". */
    dateFrom: string
    dateTo: string
}

/**
 * Vue « Analyse » de l'historique : lecture des arrivages sous l'angle
 * fournisseur. Aucune requête supplémentaire — les lignes `arrivage_manuel`
 * et le référentiel sont déjà chargés par StockProvider.
 */
export default function FournisseurAnalytics({ dateFrom, dateTo }: FournisseurAnalyticsProps) {
    const { rows } = useArrivageManuelContext()
    const { fournisseurs } = useReferentialContext()

    const loading = rows === undefined

    const analytics = useMemo(
        () => computeFournisseurAnalytics(rows ?? [], fournisseurs, { from: dateFrom, to: dateTo }),
        [rows, fournisseurs, dateFrom, dateTo],
    )

    const dormant = useMemo(
        () => inactiveFournisseurs(analytics.perFournisseur),
        [analytics.perFournisseur],
    )

    const { totals } = analytics

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatTile
                    icon={Package}
                    label="Arrivages sur la période"
                    value={totals.arrivages.toLocaleString("fr-FR")}
                    loading={loading}
                    index={0}
                />
                <StatTile
                    icon={Weight}
                    label="Tonnage déclaré"
                    value={formatTonnage(totals.weightKg)}
                    loading={loading}
                    index={1}
                />
                <StatTile
                    icon={Building2}
                    label="Fournisseurs actifs"
                    value={`${totals.activeFournisseurs} / ${fournisseurs.length}`}
                    tone="success"
                    loading={loading}
                    index={2}
                />
                <StatTile
                    icon={MoonStar}
                    label="Fournisseurs dormants"
                    value={totals.inactiveFournisseurs.toLocaleString("fr-FR")}
                    tone={totals.inactiveFournisseurs > 0 ? "warning" : "primary"}
                    loading={loading}
                    index={3}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TopFournisseursChart perFournisseur={analytics.perFournisseur} loading={loading} />
                <ArrivageStatusChart
                    perFournisseur={analytics.perFournisseur}
                    statusBreakdown={analytics.statusBreakdown}
                    loading={loading}
                />
            </div>

            <InactiveFournisseursCard inactive={dormant} loading={loading} />
        </div>
    )
}
