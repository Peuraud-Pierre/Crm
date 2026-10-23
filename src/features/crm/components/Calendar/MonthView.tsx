import React, { useMemo } from "react"
import {
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
} from "date-fns"
import { fr } from "date-fns/locale"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useCalendarContext } from "../../context/CalendarContext"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { cn } from "@/shared/lib/utils"
import { getJourFerie } from "@/features/crm/utils/joursFeries"
import type { Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"
import {
    buildAllowedOwnerSet,
    isOwnerAllowed,
} from "@/features/crm/utils/calendarConstants"
import {
    getEventTheme,
    pendingEventClass,
    pendingDotClass,
    WEEKDAYS,
    safeDate,
} from "@/features/crm/types/calendar"

export function generateMonthGrid(date: Date) {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let curr = gridStart
    while (curr <= gridEnd) {
        days.push(new Date(curr))
        curr = addDays(curr, 1)
    }
    return days
}

// ==========================================
// 🖼️ COMPOSANT PRINCIPAL
// ==========================================
interface MonthYearGridProps {
    daysToRender: Date[]
    handleDayClick: (day: Date) => void
    handleDayDoubleClick: (day: Date) => void
}

export const MonthYearGrid: React.FC<MonthYearGridProps> = ({
    daysToRender,
    handleDayClick,
    handleDayDoubleClick,
}) => {
    // 1. Récupération des données CRM
    const { events, search } = useCRMContext()
    const { user } = useAuth()

    // 2. Récupération des états d'affichage
    const { calendarView, date, setIsSidebarOpen } = useCalendarContext()

    // Vue MOIS : on n'affiche QUE les agendas fixes + le mien (aucune autre
    // personne), indépendamment du filtre gestionnaire.
    const allowedOwners = useMemo(
        () => buildAllowedOwnerSet(search, user?.user_id),
        [search, user?.user_id]
    )

    // 🚀 OPTIMISATION : Indexation des événements par jour (Évite le O(N^2) lors du rendu de la grille)
    const eventsByDay = useMemo(() => {
        const map = new Map<string, Event_creation[]>()
        if (!events) return map
        ;(events as Event_creation[]).forEach((evt) => {
            const evtDate = safeDate(evt.debut)
            if (!evtDate) return

            // Vue MOIS : cap aux agendas fixes + le mien. (La vue ANNÉE n'est pas
            // restreinte ; son fetch applique déjà le filtre gestionnaire.)
            if (calendarView === "month" && !isOwnerAllowed(evt, allowedOwners))
                return

            const dateKey = format(evtDate, "yyyy-MM-dd")
            const bucket = map.get(dateKey)
            if (bucket) bucket.push(evt)
            else map.set(dateKey, [evt])
        })

        map.forEach((dayEvents) => {
            dayEvents.sort(
                (a, b) =>
                    (safeDate(a.debut)?.getTime() || 0) -
                    (safeDate(b.debut)?.getTime() || 0)
            )
        })

        return map
    }, [events, allowedOwners, calendarView])

    // --- VUE ANNÉE ---
    if (calendarView === "year") {
        return (
            <div className="h-full grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4 py-4 overflow-y-auto min-h-0">
                {daysToRender.map((monthDate, index) => {
                    const isCurrentMonth = isSameMonth(monthDate, new Date())
                    const isSelected = date && isSameMonth(monthDate, date)

                    return (
                        <div
                            key={monthDate.toISOString()}
                            onClick={() => handleDayClick(monthDate)}
                            onDoubleClick={() =>
                                handleDayDoubleClick(monthDate)
                            }
                            style={{
                                animationDelay: `${Math.min(index * 25, 320)}ms`,
                            }}
                            className={cn(
                                "aspect-[4/3] flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors duration-base",
                                "animate-in fade-in slide-in-from-top-2 fill-mode-backwards ease-out",
                                isSelected
                                    ? "bg-red-500/10 text-red-600"
                                    : "hover:bg-muted/50 text-foreground",
                                isCurrentMonth && !isSelected && "text-red-500"
                            )}
                        >
                            <span className="text-sm md:text-lg font-semibold capitalize tracking-tight">
                                <span className="md:hidden">
                                    {format(monthDate, "MMM", { locale: fr })}
                                </span>
                                <span className="hidden md:inline">
                                    {format(monthDate, "MMMM", { locale: fr })}
                                </span>
                            </span>
                        </div>
                    )
                })}
            </div>
        )
    }

    // --- VUE MOIS ---
    const currentDisplayMonth =
        daysToRender.length > 15 ? daysToRender[15] : new Date()

    return (
        <div className="flex flex-col h-full bg-background border-none overflow-hidden shadow-sm">
            {/* En-tête Jours */}
            <div className="grid grid-cols-7 border-b border-border/20 shrink-0">
                {WEEKDAYS.map((day) => (
                    <div
                        key={day}
                        className="py-2 text-center text-[10px] md:text-xs font-medium text-muted-foreground uppercase"
                    >
                        <span className="md:hidden">{day.charAt(0)}</span>
                        <span className="hidden md:inline">{day}</span>
                    </div>
                ))}
            </div>

            {/* Grille de 35 (ou 42) cases */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden min-h-0 border-l border-border/10">
                {daysToRender.map((day, index) => {
                    // ⚡ Lecture O(1) ultra rapide via la Map pré-calculée
                    const dayKey = format(day, "yyyy-MM-dd")
                    const dayEvents = eventsByDay.get(dayKey) || []

                    const isToday = isSameDay(day, new Date())
                    const isSelected = date && isSameDay(day, date)
                    const isOutsideMonth = !isSameMonth(
                        day,
                        currentDisplayMonth
                    )
                    const jourFerie = getJourFerie(day)

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => {
                                handleDayClick(day)
                                setIsSidebarOpen(true)
                            }}
                            onDoubleClick={() => handleDayDoubleClick(day)}
                            style={{
                                animationDelay: `${Math.min(index * 12, 320)}ms`,
                            }}
                            className={cn(
                                "relative overflow-hidden p-1 md:p-1.5 border-b border-r border-border/10 transition-colors group cursor-pointer flex flex-col items-center md:items-stretch hover:z-10",
                                "animate-in fade-in slide-in-from-top-2 fill-mode-backwards duration-slow ease-out",
                                isOutsideMonth
                                    ? "bg-muted/10"
                                    : jourFerie
                                      ? "bg-amber-50/60 dark:bg-amber-900/10"
                                      : "bg-background hover:bg-muted/30"
                            )}
                        >
                            {/* Numéro du jour */}
                            <div className="flex justify-center mb-1">
                                <span
                                    className={cn(
                                        "text-sm md:text-[15px] font-medium w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors tracking-tight",
                                        isToday
                                            ? "bg-destructive text-destructive-foreground font-semibold shadow-sm"
                                            : isSelected
                                              ? "bg-foreground text-background font-semibold"
                                              : "text-foreground",
                                        isOutsideMonth &&
                                            !isSelected &&
                                            !isToday &&
                                            "text-muted-foreground/40"
                                    )}
                                >
                                    {format(day, "d")}
                                </span>
                            </div>

                            {/* Label jour férié */}
                            {jourFerie && !isOutsideMonth && (
                                <div className="hidden md:block text-[9px] text-amber-600 dark:text-amber-400 font-medium truncate text-center mb-0.5">
                                    {jourFerie}
                                </div>
                            )}

                            {/* Conteneur des événements */}
                            <div className="flex flex-col gap-0.5 md:gap-1 w-full items-center md:items-stretch flex-1 px-0.5">
                                {/* Mobile : Pastilles collées */}
                                <div className="flex flex-wrap justify-center gap-[3px] md:hidden">
                                    {jourFerie && !isOutsideMonth && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    )}
                                    {dayEvents.slice(0, 4).map((evt) => {
                                        const theme = getEventTheme(evt.nom)
                                        return (
                                            <span
                                                key={`dot-${evt.id ?? evt.debut}`}
                                                className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    theme.dot,
                                                    pendingDotClass(
                                                        evt.confirmed
                                                    ),
                                                    isOutsideMonth &&
                                                        "opacity-40 grayscale"
                                                )}
                                            />
                                        )
                                    })}
                                </div>

                                {/* Desktop : Étiquettes épurées */}
                                <div className="hidden md:flex flex-col gap-0.5 w-full">
                                    {dayEvents.slice(0, 4).map((evt) => {
                                        const theme = getEventTheme(evt.nom)
                                        const isUnavailable =
                                            evt.nom === "Non Disponible" ||
                                            evt.nom === "Indisponible"
                                        const displayTitle = isUnavailable
                                            ? "Indisponible"
                                            : evt.description || "Sans titre"

                                        return (
                                            <div
                                                key={`label-${evt.id ?? evt.debut}`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDayClick(day)
                                                    setIsSidebarOpen(true)
                                                }}
                                                className={cn(
                                                    "px-1.5 py-0.5 text-[10px] md:text-[11px] rounded-[4px] truncate font-medium transition-opacity hover:opacity-80 cursor-pointer w-full",
                                                    theme.bg,
                                                    theme.text,
                                                    pendingEventClass(
                                                        evt.confirmed
                                                    ),
                                                    isOutsideMonth &&
                                                        "opacity-50 grayscale"
                                                )}
                                            >
                                                <span className="font-semibold mr-1">
                                                    {format(
                                                        safeDate(evt.debut) ??
                                                            new Date(),
                                                        "HH:mm"
                                                    )}
                                                </span>
                                                {displayTitle}
                                            </div>
                                        )
                                    })}
                                    {dayEvents.length > 4 && (
                                        <div className="text-[10px] text-muted-foreground font-medium text-center mt-0.5 hover:text-foreground">
                                            {dayEvents.length - 4} de plus
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
