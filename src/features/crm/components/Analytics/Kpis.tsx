import React, { type ComponentType } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Euro,
    ShoppingCart,
    Users,
    Activity,
    CalendarDays,
    ListTodo,
    CheckCircle2,
    Trophy,
} from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { useAnalytics } from "../../context/AnalyticsContext"
import { TARGET_IDS } from "./Widget/EventsPalier"

// On reprend les mêmes paliers que le widget de gamification
const PALIERS = [
    { level: 1, name: "Standard", max: 400 },
    { level: 2, name: "Bronze", max: 410 },
    { level: 3, name: "Argent", max: 440 },
    { level: 4, name: "Or", max: 500 },
    { level: 5, name: "Platine", max: 1000 },
    { level: 6, name: "Prestige", max: Infinity },
]

interface StatCardProps {
    title: string
    value: React.ReactNode
    subtitle?: string
    icon: ComponentType<{ className?: string }>
    trend?: number | null
    delay?: number
}

const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    delay = 0,
}: StatCardProps) => {
    const isPositive = trend !== null && trend !== undefined && trend >= 0
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="h-full"
        >
            <Card className="relative overflow-hidden p-4 sm:p-6 group bg-gradient-to-br from-background to-muted/30 border-border/50 h-full flex flex-col justify-between">
                <div className="relative z-10 flex items-start justify-between mb-4">
                    <div className="rounded-xl bg-primary/10 p-2.5 sm:p-3 text-primary ring-1 ring-primary/20">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    {trend !== null && trend !== undefined ? (
                        <Badge
                            className={cn(
                                "flex items-center gap-1 font-semibold text-xs",
                                isPositive
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-rose-500/10 text-rose-600"
                            )}
                            variant="secondary"
                        >
                            {isPositive ? "+" : ""}
                            {trend.toFixed(1)}%
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className="text-muted-foreground bg-background/50 text-xs"
                        >
                            —
                        </Badge>
                    )}
                </div>
                <div className="relative z-10 mt-auto">
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {value}
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
                        {title}{" "}
                        {subtitle && (
                            <span className="text-[9px] uppercase tracking-wider opacity-70 border-l pl-2 ml-2">
                                {subtitle}
                            </span>
                        )}
                    </p>
                </div>
            </Card>
        </motion.div>
    )
}

export function AnalyticsKPIs() {
    const { KPIs, totalClients, selectedCommercial, memberStats } =
        useAnalytics()

    // 1. Calcul mathématique du nombre de RDV du mois précédent
    const currentRdv = KPIs.totalRdv || 0
    let prevRdv = 0
    if (KPIs.rdvChange !== null && KPIs.rdvChange !== undefined) {
        // Formule inverse du pourcentage d'évolution : Ancien = Nouveau / (1 + (Pourcentage / 100))
        prevRdv = Math.round(currentRdv / (1 + KPIs.rdvChange / 100))
    }

    // 2. Fonction pour trouver le Palier (Statut)
    const getTier = (volume: number) => {
        let index = PALIERS.findIndex((p) => volume < p.max)
        if (index === -1) index = PALIERS.length - 1
        return PALIERS[index]
    }

    const prevTier = getTier(prevRdv)

    // Les commerciaux affichant le widget « Paliers de performance » n'ont pas
    // de chiffre d'affaires ni de devis à afficher : on masque ces deux cartes.
    const hideRevenueAndDevis = TARGET_IDS.has(selectedCommercial)

    return (
        <>
            <AnimatePresence>
                {selectedCommercial !== "all" && memberStats && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                            opacity: 1,
                            height: "auto",
                            marginBottom: 24,
                        }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="bg-primary/[0.03] border-primary/20 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner shrink-0">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
                                        {memberStats.userName}
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] bg-background text-muted-foreground w-fit mx-auto sm:mx-0"
                                        >
                                            <Trophy className="w-3 h-3 mr-1.5 opacity-70" />
                                            Statut précédent : {prevTier.name} (
                                            {prevRdv} RDV)
                                        </Badge>
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                                        Résumé de l'activité sur la période
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto mt-4 sm:mt-0">
                                <div className="flex-1 sm:flex-none bg-background/60 border rounded-xl p-3 px-5 flex flex-col items-center sm:items-start min-w-[140px]">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                        <CalendarDays className="h-3 w-3 text-blue-500" />{" "}
                                        RDV Pris
                                    </span>
                                    <span className="text-xl font-black text-blue-600">
                                        {memberStats.rdvCount}
                                    </span>
                                </div>
                                <div className="flex-1 sm:flex-none bg-background/60 border rounded-xl p-3 px-5 flex flex-col items-center sm:items-start min-w-[140px]">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                        <ListTodo className="h-3 w-3 text-emerald-500" />{" "}
                                        Activités
                                    </span>
                                    <span className="text-xl font-black text-emerald-600">
                                        {memberStats.actCount}
                                    </span>
                                </div>
                                <div className="flex-1 sm:flex-none bg-background/60 border rounded-xl p-3 px-5 flex flex-col items-center sm:items-start min-w-[140px]">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                                        <CheckCircle2 className="h-3 w-3 text-purple-500" />{" "}
                                        Tâches terminées
                                    </span>
                                    <span className="text-xl font-black text-purple-600">
                                        {memberStats.completedTasksCount}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className={cn(
                    "grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6",
                    hideRevenueAndDevis ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-4"
                )}
            >
                {!hideRevenueAndDevis && (
                    <>
                        <StatCard
                            title="Chiffre d'affaires"
                            value={KPIs.totalRevenue.toLocaleString("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                            })}
                            icon={Euro}
                            trend={KPIs.revenueChange}
                            delay={0.1}
                        />
                        <StatCard
                            title="Bon générés"
                            value={KPIs.totalDevis}
                            icon={ShoppingCart}
                            trend={KPIs.devisChange}
                            delay={0.2}
                        />
                    </>
                )}
                <StatCard
                    title="Rendez-vous créés"
                    value={KPIs.totalRdv}
                    icon={CalendarDays}
                    trend={KPIs.rdvChange}
                    delay={0.4}
                />
                <StatCard
                    title="Clients totaux"
                    value={totalClients}
                    icon={Activity}
                    delay={0.5}
                />
            </div>
        </>
    )
}
