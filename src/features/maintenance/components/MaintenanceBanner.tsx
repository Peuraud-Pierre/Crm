"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Clock } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useMaintenanceContext } from "../hooks/context/MaintenanceProvider"

const MINUTE_MS = 1000 * 60
const HOUR_MS = MINUTE_MS * 60
const DAY_MS = HOUR_MS * 24

/** « 2 jours 3h 10min », « 3h 10min », « 10 min ». */
function formatTimeLeft(diffMs: number): string {
    if (diffMs <= 0) return "Moins d'une minute"

    const totalMinutes = Math.floor(diffMs / MINUTE_MS)
    const totalHours = Math.floor(totalMinutes / 60)
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    const minutes = totalMinutes % 60

    if (days > 0)
        return `${days} jour${days > 1 ? "s" : ""} ${hours}h ${minutes}min`
    if (totalHours > 0) return `${totalHours}h ${minutes}min`
    return `${minutes} min`
}

/**
 * Compte à rebours affiché dans le header avant une maintenance globale
 * programmée. Rien n'est affiché une fois la maintenance active : à ce
 * moment-là l'utilisateur voit déjà `MaintenanceScreen` à la place du
 * contenu — sauf s'il détient `maintenance.bypass`, auquel cas le bandeau
 * lui signale qu'il travaille pendant une coupure.
 *
 * (La version précédente contenait une branche morte : un `return null`
 * sur `maintenance.Active` suivi d'un bloc conditionné sur ce même
 * `Active`, donc inatteignable.)
 */
export function MaintenanceBanner() {
    const { state, canBypass } = useMaintenanceContext()
    const globalWindow = state.global

    const startsAtMs = useMemo(
        () =>
            globalWindow ? new Date(globalWindow.starts_at).getTime() : null,
        [globalWindow]
    )

    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (startsAtMs === null) return
        const interval = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(interval)
    }, [startsAtMs])

    if (!globalWindow || startsAtMs === null) return null

    // Maintenance en cours : seul un porteur du contournement voit encore
    // l'application, et c'est à lui que ce rappel s'adresse.
    if (globalWindow.active) {
        if (!canBypass) return null
        return (
            <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 px-3 py-1.5 shadow-sm">
                <AlertTriangle className="size-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                    Maintenance en cours
                </span>
            </div>
        )
    }

    const diff = startsAtMs - now

    // Plus la coupure approche, plus l'alerte monte : au-delà d'un jour
    // c'est une information, sous l'heure c'est une urgence.
    const toneClass =
        diff < HOUR_MS
            ? "text-destructive"
            : diff < DAY_MS
              ? "text-warning"
              : "text-primary"

    return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
            <AlertTriangle className={cn("size-4", toneClass)} />
            <span className={cn("text-sm font-medium", toneClass)}>
                Maintenance prévue dans {formatTimeLeft(diff)}
            </span>
            <Clock className="size-4 text-muted-foreground" />
        </div>
    )
}
