import { useMemo } from "react"
import { ArrowDownToLine, Package2, PackageCheck, TrendingUp } from "lucide-react"

import {
    useBalleContext,
    useDeliveryContext,
    useArrivageManuelContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import { referenceArrivageManuel } from "@/features/stock/types/arrivage-manuel.types"

import { KpiCard } from "./KpiCard"
import { BalleSearchSection } from "./sections/BalleSearch"
import { RecentActivitySection } from "./sections/RecentActivity"
import { GESTION_THEME } from "@/features/stock/theme"

export default function StockDashboard() {
    const { balles }     = useBalleContext()
    const { deliveries } = useDeliveryContext()
    const { rows: arrivages } = useArrivageManuelContext()
    const { categories } = useReferentialContext()

    const now        = useMemo(() => new Date(), [])
    const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now])
    const catMap     = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

    const globalKpis = useMemo(() => {
        const allBalles     = balles ?? []
        const allDeliveries = deliveries ?? []
        const allArrivages  = arrivages ?? []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const ballesTock  = allBalles.filter((b) => b.status === "stocked").length
        const valeurStock = allBalles
            .filter((b) => b.status === "stocked")
            .reduce((sum, b) => sum + b.packing * (catMap.get(b.category_id)?.unit_price ?? 0), 0)

        const livraisonsMois = allDeliveries.filter((d) =>
            !!d.delivery_date && new Date(d.delivery_date) >= monthStart
        ).length

        const arrivagesToCome = allArrivages.filter((a) => {
            if (a.status === "annulé") return false
            const ref = referenceArrivageManuel(a)
            if (!ref) return false
            const d = new Date(ref)
            d.setHours(0, 0, 0, 0)
            return d >= today
        }).length

        return { ballesTock, valeurStock, livraisonsMois, arrivagesToCome }
    }, [balles, deliveries, arrivages, catMap, monthStart])

    if (balles === undefined || deliveries === undefined || arrivages === undefined) {
        return <div className="p-6 text-sm text-slate-500">Chargement…</div>
    }

    return (
        <div className="space-y-6 p-4">

            {/* Vue d'ensemble */}
            <div>
                <h2 className={`${GESTION_THEME.section.groupTitle} mb-3`}>
                    Vue d'ensemble
                </h2>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <KpiCard
                        title="Balles en stock"
                        value={globalKpis.ballesTock}
                        icon={<Package2 size={18} />}
                        hint="Statut stocked"
                    />
                    <KpiCard
                        title="Livraisons ce mois"
                        value={globalKpis.livraisonsMois}
                        icon={<PackageCheck size={18} />}
                        hint={now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    />
                    <KpiCard
                        title="Arrivages à venir"
                        value={globalKpis.arrivagesToCome}
                        icon={<ArrowDownToLine size={18} />}
                        hint="Imports planifiés"
                    />
                    <KpiCard
                        title="Valeur stock estimée"
                        value={globalKpis.valeurStock.toLocaleString("fr-FR", {
                            style: "currency", currency: "EUR", maximumFractionDigits: 0,
                        })}
                        icon={<TrendingUp size={18} />}
                        hint="Balles stocked × prix unitaire"
                    />
                </div>
            </div>

            {/* Corps : contenu principal + sidebar activité */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* Sidebar activité — en haut sur mobile, à droite sur desktop */}
                <div className="order-first lg:order-last w-full lg:w-72 xl:w-80 lg:shrink-0 lg:sticky lg:top-4">
                    <RecentActivitySection />
                </div>

                {/* Contenu principal */}
                <div className="flex-1 min-w-0 space-y-8">
                    <BalleSearchSection />
                </div>

            </div>

        </div>
    )
}
