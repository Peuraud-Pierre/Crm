import { motion } from "framer-motion"
import { useAnalytics } from "../../../context/AnalyticsContext"
import { Card } from "@/shared/ui/atoms/card"
import { Target, Award, Medal, Star, Diamond, Trophy } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// 🏢 DÉFINITION DES STATUTS DE PERFORMANCE (Façon B2B / Ventes)
const PALIERS = [
    {
        level: 1,
        name: "Standard",
        max: 400,
        icon: Target,
        color: "text-slate-600 dark:text-slate-400",
        bg: "bg-slate-500/10",
        fill: "bg-slate-500",
    },
    {
        level: 2,
        name: "Bronze",
        max: 410,
        icon: Award,
        color: "text-orange-600 dark:text-orange-500",
        bg: "bg-orange-500/10",
        fill: "bg-orange-500",
    },
    {
        level: 3,
        name: "Argent",
        max: 440,
        icon: Medal,
        color: "text-zinc-500 dark:text-zinc-400",
        bg: "bg-zinc-500/10",
        fill: "bg-zinc-400",
    },
    {
        level: 4,
        name: "Or",
        max: 500,
        icon: Star,
        color: "text-amber-500 dark:text-amber-400",
        bg: "bg-amber-500/10",
        fill: "bg-amber-400",
    },
    {
        level: 5,
        name: "Platine",
        max: 1000,
        icon: Diamond,
        color: "text-cyan-600 dark:text-cyan-400",
        bg: "bg-cyan-500/10",
        fill: "bg-cyan-500",
    },
    {
        level: 6,
        name: "Prestige",
        max: Infinity,
        icon: Trophy,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-500/10",
        fill: "bg-indigo-500",
    },
]

export function WidgetGamification() {
    const { KPIs, memberStats, selectedCommercial } = useAnalytics()

    // Volume = Nombre de RDV créés
    const currentVolume =
        selectedCommercial === "all"
            ? KPIs.totalRdv
            : memberStats?.rdvCount || 0

    // 🧠 LOGIQUE DE STATUT
    let currentTierIndex = PALIERS.findIndex((p) => currentVolume < p.max)
    if (currentTierIndex === -1) currentTierIndex = PALIERS.length - 1

    const currentTier = PALIERS[currentTierIndex]
    const nextTier =
        currentTierIndex < PALIERS.length - 1
            ? PALIERS[currentTierIndex + 1]
            : null

    // Calcul de la progression
    const volumeBase =
        currentTierIndex === 0 ? 0 : PALIERS[currentTierIndex - 1].max
    const volumeRequired = currentTier.max - volumeBase
    const volumeGainedInTier = currentVolume - volumeBase
    const progressPercentage =
        currentTier.max === Infinity
            ? 100
            : Math.min(
                  100,
                  Math.max(0, (volumeGainedInTier / volumeRequired) * 100)
              )

    const CurrentIcon = currentTier.icon
    const NextIcon = nextTier?.icon || Trophy

    return (
        <motion.div
            key="w-performance-tier"
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full xl:col-span-2"
        >
            <Card className="p-4 sm:p-5 border-border/50 w-full flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-card/60 backdrop-blur-sm">
                {/* 1. STATUT ACTUEL (Section Gauche) */}
                <div className="flex items-center gap-4 shrink-0 min-w-[220px]">
                    <div
                        className={cn(
                            "p-4 rounded-xl border border-border/50",
                            currentTier.bg
                        )}
                    >
                        <CurrentIcon
                            className={cn("h-7 w-7", currentTier.color)}
                        />
                    </div>
                    <div>
                        <h3 className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            {selectedCommercial === "all"
                                ? "Statut de l'équipe"
                                : "Statut de performance"}
                        </h3>
                        <h2
                            className={cn(
                                "text-xl sm:text-2xl font-bold uppercase tracking-tight leading-none",
                                currentTier.color
                            )}
                        >
                            {currentTier.name}
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-foreground mt-1.5">
                            Volume réalisé :{" "}
                            <span className="font-bold">
                                {currentVolume} RDV
                            </span>
                        </p>
                    </div>
                </div>

                {/* 2. BARRE DE PROGRESSION (Section Centrale) */}
                <div className="flex-1 w-full">
                    <div className="flex justify-between items-end mb-2 px-1">
                        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Progression vers le statut supérieur
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">
                            {currentTier.max === Infinity ? (
                                "Objectif Final Atteint"
                            ) : (
                                <>
                                    <span className="text-foreground">
                                        {volumeGainedInTier}
                                    </span>{" "}
                                    / {volumeRequired} RDV
                                </>
                            )}
                        </span>
                    </div>

                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden border border-border/30">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={cn("h-full", currentTier.fill)}
                        />
                    </div>
                </div>

                {/* 3. PROCHAIN OBJECTIF (Section Droite) */}
                <div className="flex items-center gap-4 shrink-0 min-w-[200px] md:justify-end">
                    {nextTier ? (
                        <>
                            <div className="text-right">
                                <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                                    Prochain Jalon
                                </p>
                                <p className="text-base sm:text-lg font-bold text-foreground leading-none">
                                    Statut {nextTier.name}
                                </p>
                                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mt-1.5">
                                    Cible globale :{" "}
                                    <span className="font-bold text-foreground">
                                        {currentTier.max} RDV
                                    </span>
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted border border-border/50 opacity-50 grayscale">
                                <NextIcon
                                    className={cn("h-6 w-6", nextTier.color)}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg px-6 py-3 w-full text-center">
                            <p className="text-primary font-bold text-xs uppercase tracking-widest">
                                ⭐ Performance Maximale
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    )
}
