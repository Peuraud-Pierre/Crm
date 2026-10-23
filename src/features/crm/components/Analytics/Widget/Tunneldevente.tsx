import { useMemo } from "react"
import { motion } from "framer-motion"
import { Card } from "@/shared/ui/atoms/card"
import { Filter } from "lucide-react"
import { useAnalytics } from "@/features/crm/context/AnalyticsContext"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

// Une palette de 7 couleurs (du "froid/nouveau" au "chaud/converti", et gris pour dormant)
const DEFAULT_COLORS = [
    "hsl(var(--chart-8))", // Nouveau lead (gris)
    "hsl(var(--chart-2))", // En qualification (bleu)
    "hsl(var(--chart-4))", // En incubation (violet)
    "hsl(var(--chart-6))", // 1er RDV (rose)
    "hsl(var(--chart-5))", // 1ère commande (jaune)
    "hsl(var(--chart-1))", // Fidélisation (vert)
    "hsl(var(--muted-foreground))", // Dormant (gris clair)
]

const STAGES = [
    "Nouveau lead",
    "En qualification",
    "En incubation",
    "1er RDV entrepôt",
    "1ère commande / Test",
    "Fidélisation / Client Actif",
    "Dormant",
]

export function WidgetFunnel() {
    // Le composant récupère sa data via le contexte. Source principale : la RPC
    // get_client_column_counts (pipelineColumnCounts) → instantané. Repli sur
    // les clients paginés (filteredClients) tant que la RPC n'a pas répondu / a
    // échoué, pour ne pas afficher un tunnel vide.
    const { pipelineColumnCounts, filteredClients } = useAnalytics()

    const stats = useMemo(() => {
        // Compte par colonne : on privilégie la RPC ; sinon on dérive des
        // clients en mémoire (fallback).
        const countForColumn = (index: number): number => {
            if (pipelineColumnCounts) return pipelineColumnCounts[index] || 0
            return (filteredClients || []).filter((c) => c.collum === index)
                .length
        }

        const total = pipelineColumnCounts
            ? Object.values(pipelineColumnCounts).reduce(
                  (acc, n) => acc + (Number(n) || 0),
                  0
              )
            : (filteredClients || []).length

        const data = STAGES.map((stage, index) => {
            const count = countForColumn(index)
            return {
                stage,
                value: count,
                // Pourcentage par rapport au total des clients
                percentageOfTotal: total > 0 ? (count / total) * 100 : 0,
            }
        })

        // La valeur maximale sert à définir la largeur 100% de la jauge visuelle
        const maxValue = Math.max(...data.map((d) => d.value), 1)

        return { data, total, maxValue }
    }, [pipelineColumnCounts, filteredClients])

    return (
        <motion.div
            key="w-funnel"
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="xl:col-span-2 w-full"
        >
            {stats.total === 0 ? (
                <Card className="border-border/50 shadow-surface h-full min-h-[380px] flex flex-col justify-center">
                    <EmptyState
                        icon={Filter}
                        title="Aucune donnée"
                        description="Le tunnel de conversion se remplit dès le premier évènement de la période."
                    />
                </Card>
            ) : (
                <Card className="p-4 sm:p-6 border-border/50 shadow-sm h-full min-h-[380px]">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold">
                                Tunnel de conversion
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                Répartition sur {stats.total} contacts
                            </p>
                        </div>
                        <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {stats.data.map((stageData, index) => {
                            // Calcul de la largeur de la barre (relative au max pour bien utiliser l'espace)
                            const widthPercentage =
                                (stageData.value / stats.maxValue) * 100
                            const color =
                                DEFAULT_COLORS[index % DEFAULT_COLORS.length]

                            return (
                                <div
                                    key={stageData.stage}
                                    style={{
                                        animationDelay: `${index * 80}ms`,
                                    }}
                                    className="group relative animate-in fade-in slide-in-from-left-12 fill-mode-backwards duration-slower ease-overshoot"
                                >
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                            {stageData.stage}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-muted-foreground">
                                                {stageData.percentageOfTotal.toFixed(
                                                    1
                                                )}
                                                %
                                            </span>
                                            <span className="text-sm font-black bg-muted px-2 py-0.5 rounded-md min-w-[2.5rem] text-center">
                                                {stageData.value}
                                            </span>
                                        </div>
                                    </div>

                                    {/* La piste grise de la jauge */}
                                    <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden border border-border/50">
                                        {/* La jauge colorée animée */}
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
                                            {/* Petit effet de brillance interne */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                                        </motion.div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            )}
        </motion.div>
    )
}
