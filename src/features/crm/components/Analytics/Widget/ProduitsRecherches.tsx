import { useMemo } from "react"
import { motion } from "framer-motion"
import { Card } from "@/shared/ui/atoms/card"
import { Search } from "lucide-react"
import { useAnalytics, CHART_COLORS } from "../../../context/AnalyticsContext"

// Au-delà de ce nombre de lignes le classement devient illisible : on garde
// les plus recherchés et on agrège la longue traîne dans une ligne « Autres ».
const MAX_ROWS = 8

export function WidgetProduitsRecherches() {
    const { produitsRechercheRankingData } = useAnalytics()

    // produitsRechercheRankingData.data est trié par count décroissant (cf. contexte).
    const rows = useMemo(() => {
        const data = produitsRechercheRankingData.data || []
        if (data.length <= MAX_ROWS) return data
        const head = data.slice(0, MAX_ROWS - 1)
        const rest = data.slice(MAX_ROWS - 1)
        const othersCount = rest.reduce((acc, d) => acc + (d.count || 0), 0)
        return [
            ...head,
            { name: `Autres (${rest.length})`, count: othersCount },
        ]
    }, [produitsRechercheRankingData.data])

    const maxValue = Math.max(...rows.map((r) => r.count), 1)

    return (
        <motion.div
            key="w-produits-recherches"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Produits et styles les plus recherchés
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            {produitsRechercheRankingData.leads !== null &&
                                `${produitsRechercheRankingData.leads} leads analysés · `}
                            {produitsRechercheRankingData.total} produits et
                            styles cités
                        </p>
                        {!!produitsRechercheRankingData.sansProduit && (
                            <p className="text-xs text-muted-foreground">
                                {produitsRechercheRankingData.sansProduit} leads
                                sans produit ni style renseigné (hors
                                classement)
                            </p>
                        )}
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <Search className="h-5 w-5 text-blue-600" />
                    </div>
                </div>
                {rows.length > 0 ? (
                    <div className="space-y-4">
                        {rows.map((row, index) => {
                            const widthPercentage = (row.count / maxValue) * 100
                            const color =
                                CHART_COLORS[index % CHART_COLORS.length]
                            const percentageOfTotal =
                                produitsRechercheRankingData.total > 0
                                    ? (row.count /
                                          produitsRechercheRankingData.total) *
                                      100
                                    : 0

                            return (
                                <div
                                    key={row.name}
                                    style={{
                                        animationDelay: `${index * 80}ms`,
                                    }}
                                    className="group relative animate-in fade-in slide-in-from-left-12 fill-mode-backwards duration-slower ease-overshoot"
                                >
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                            {row.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-muted-foreground">
                                                {percentageOfTotal.toFixed(1)}%
                                            </span>
                                            <span className="text-sm font-black bg-muted px-2 py-0.5 rounded-md min-w-[2.5rem] text-center">
                                                {row.count}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden border border-border/50">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${widthPercentage}%`,
                                            }}
                                            transition={{
                                                duration: 0.8,
                                                delay: index * 0.1,
                                                ease: "easeOut",
                                            }}
                                            className="h-full rounded-full relative"
                                            style={{ backgroundColor: color }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                                        </motion.div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm italic">
                        Aucune donnée pour cette période
                    </div>
                )}
            </Card>
        </motion.div>
    )
}
