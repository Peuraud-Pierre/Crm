import { Clock } from "lucide-react"
import { useEffect, useState, memo } from "react"

/** Calcule la chaîne "HH:MM:SS" écoulée depuis startDate (ou un libellé d'erreur). */
function formatElapsed(startDate: string): string {
    if (!startDate) return "00:00:00"

    const safeDate = startDate.replace(" ", "T")
    const startTime = new Date(safeDate).getTime()
    if (isNaN(startTime)) return "Err"

    const diff = Date.now() - startTime
    if (diff < 0) return "00:00:00"

    const totalSeconds = Math.floor(diff / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [hours, minutes, seconds]
        .map((n) => String(n).padStart(2, "0"))
        .join(":")
}

export const LiveTimer = memo(function LiveTimer({
    startDate,
}: {
    startDate: string
}) {
    // Valeur initiale dérivée immédiatement (pas de setState au montage).
    const [timeString, setTimeString] = useState(() => formatElapsed(startDate))

    useEffect(() => {
        // Recalage immédiat quand startDate change (sinon décalage jusqu'à 1s).
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- recalage synchrone volontaire d'un timer sur changement de prop
        setTimeString(formatElapsed(startDate))
        const safeDate = startDate.replace(" ", "T")
        if (!startDate || isNaN(new Date(safeDate).getTime())) return

        const interval = setInterval(() => {
            setTimeString(formatElapsed(startDate))
        }, 1000)

        return () => clearInterval(interval)
    }, [startDate])

    return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/70 text-destructive-foreground font-mono text-[10px] font-bold shadow-sm shrink-0 whitespace-nowrap">
            <Clock className="h-3 w-3" />
            {timeString}
        </span>
    )
})
