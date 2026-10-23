import React, { memo, useState, useEffect, useMemo, useRef } from "react"
import {
    differenceInMinutes,
    startOfDay,
    endOfDay,
    isSameDay,
    format,
    addMinutes,
    roundToNearestMinutes,
} from "date-fns"
import { Briefcase } from "lucide-react"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"
import { cn } from "@/shared/lib/utils"
import { getJourFerie } from "@/features/crm/utils/joursFeries"
import {
    computeOverlapGroups,
    groupEventsByOwner,
    type OwnerColumn,
} from "@/features/crm/utils/crmCompute"
import { safeDate } from "@/features/crm/utils/safeDate"
import { getEventTheme } from "@/features/crm/utils/eventTypes"
import { pendingEventClass } from "@/features/crm/utils/calendarConstants"
import { getCustomerUserId } from "@/features/crm/utils/invariants"
import {
    FIXED_OWNER_IDS,
    PINNED_LAST_OWNER_IDS,
} from "@/features/crm/utils/calendarConstants"
import {
    createDragActivation,
    getPointerPosition,
    isTouchEvent,
    signalDragActivation,
} from "@/features/crm/utils/dragActivation"
import { useCalendarContext } from "@/features/crm/context/CalendarContext"

interface UnavailabilitySlot {
    debut: string
    fin: string
}

// Plage horaire affichée (journée de travail) : mêmes bornes que la vue
// Semaine (WeekView.tsx). Les événements en dehors restent en base et
// s'affichent normalement dans les autres vues, seule cette grille les masque.
const VISIBLE_START_HOUR = 8
const VISIBLE_END_HOUR = 19

// Heures visibles (valeurs stables comme clés React, plutôt que l'index du tableau)
const HOURS = Array.from(
    { length: VISIBLE_END_HOUR - VISIBLE_START_HOUR },
    (_, i) => i + VISIBLE_START_HOUR
)

// Position verticale (px) d'un instant exprimé en minutes depuis minuit,
// recalée sur le début de la plage visible plutôt que sur minuit — sinon la
// grille afficherait 8h en haut mais les événements se positionneraient
// comme si 0h était en haut.
const minutesToTopPx = (minutesFromMidnight: number, hourHeight: number) =>
    (minutesFromMidnight / 60 - VISIBLE_START_HOUR) * hourHeight

// FIXED_OWNER_IDS est désormais centralisé dans utils/calendarConstants.ts
// (partagé par les vues Jour, Mois et Semaine).

// ==========================================
// 1. HOOKS & UTILS
// ==========================================
const useEventDrag = (
    evt: Event_creation,
    updateEvent: (evt: Event_creation) => void,
    hourHeight: number,
    durationMinutes: number,
    dayStart: Date
) => {
    const elementRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)

    // Démontage en plein geste (changement de jour, refetch) : sans ça les
    // listeners document fuient et le timer d'appui long reste armé.
    const cleanupRef = useRef<(() => void) | null>(null)
    useEffect(() => () => cleanupRef.current?.(), [])

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation()
        if ((e.target as HTMLElement).dataset.resize) return

        const el = elementRef.current
        if (!el) return

        const isTouch = isTouchEvent(e)
        const startY = getPointerPosition(e).y
        const startTop = parseFloat(el.style.top || "0")
        let newTop = startTop

        // Souris : drag dès 5px, comme avant. Tactile : appui long de 250ms,
        // sinon le moindre scroll posé sur un RDV le déplaçait (et le
        // sauvegardait) au relâchement.
        const activation = createDragActivation({
            isTouch,
            onActivate: () => {
                setIsDragging(true)
                document.body.style.cursor = "grabbing"
                if (isTouch) signalDragActivation()
            },
        })

        const onMove = (moveEvent: MouseEvent | TouchEvent) => {
            const deltaY = getPointerPosition(moveEvent).y - startY
            if (!activation.update(0, deltaY)) return
            // Drag actif : on confisque le geste au scroll de la grille
            // (listener enregistré en `passive: false` plus bas).
            if (isTouch && moveEvent.cancelable) moveEvent.preventDefault()
            newTop = Math.max(0, startTop + deltaY)
            el.style.top = `${newTop}px`
        }

        const teardown = () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            document.removeEventListener("touchmove", onMove)
            document.removeEventListener("touchend", onUp)
            document.removeEventListener("touchcancel", onCancel)
            document.body.style.cursor = ""
            activation.cancel()
            setIsDragging(false)
            cleanupRef.current = null
        }

        const onUp = () => {
            const wasDragging = activation.isActive
            teardown()

            // Simple clic, scroll, ou appui long relâché sans bouger : rien à
            // sauvegarder (sinon on écrit en base une position identique).
            if (!wasDragging || newTop === startTop) return

            // newTop est relatif au haut de la grille (VISIBLE_START_HOUR), pas à
            // minuit — on rajoute cet offset pour retrouver l'heure réelle.
            const minutesFromTop =
                (newTop / hourHeight) * 60 + VISIBLE_START_HOUR * 60
            const newStart = new Date(
                dayStart.getTime() + minutesFromTop * 60000
            )
            const newEnd = new Date(
                newStart.getTime() + durationMinutes * 60000
            )

            updateEvent({
                ...evt,
                // Préserver le propriétaire (FK profiles.user_id) ; sinon
                // update_Event écrase `customer` car evt.owner est absent.
                owner: evt.owner ?? getCustomerUserId(evt.customer),
                debut: format(newStart, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                fin: format(newEnd, "yyyy-MM-dd'T'HH:mm:ssxxx"),
            })
        }

        // Geste repris par le navigateur (scroll natif, appel entrant) :
        // on remet la carte en place et on ne sauvegarde rien.
        const onCancel = () => {
            teardown()
            el.style.top = `${startTop}px`
        }

        cleanupRef.current = teardown

        if (isTouch) {
            document.addEventListener("touchmove", onMove, { passive: false })
            document.addEventListener("touchend", onUp)
            document.addEventListener("touchcancel", onCancel)
        } else {
            document.addEventListener("mousemove", onMove)
            document.addEventListener("mouseup", onUp)
        }
    }

    const handleResizeDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation()

        const el = elementRef.current
        if (!el) return

        const isTouch = isTouchEvent(e)
        const startY = getPointerPosition(e).y
        const startHeight = parseFloat(el.style.height || "0")
        let newHeight = startHeight

        const activation = createDragActivation({
            isTouch,
            onActivate: () => {
                setIsResizing(true)
                document.body.style.cursor = "row-resize"
                if (isTouch) signalDragActivation()
            },
        })

        const onMove = (moveEvent: MouseEvent | TouchEvent) => {
            const deltaY = getPointerPosition(moveEvent).y - startY
            if (!activation.update(0, deltaY)) return
            if (isTouch && moveEvent.cancelable) moveEvent.preventDefault()
            newHeight = Math.max(hourHeight * 0.25, startHeight + deltaY) // Min 15 mins
            el.style.height = `${newHeight}px`
        }

        const teardown = () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            document.removeEventListener("touchmove", onMove)
            document.removeEventListener("touchend", onUp)
            document.removeEventListener("touchcancel", onCancel)
            document.body.style.cursor = ""
            activation.cancel()
            setIsResizing(false)
            cleanupRef.current = null
        }

        const onUp = () => {
            const wasResizing = activation.isActive
            teardown()

            // Aucun redimensionnement effectif → ne rien sauvegarder.
            if (!wasResizing || newHeight === startHeight) return

            const newDurationMinutes = (newHeight / hourHeight) * 60
            const start = new Date(evt.debut)
            const newEnd = new Date(
                start.getTime() + newDurationMinutes * 60000
            )

            updateEvent({
                ...evt,
                owner: evt.owner ?? getCustomerUserId(evt.customer),
                fin: format(newEnd, "yyyy-MM-dd'T'HH:mm:ssxxx"),
            })
        }

        const onCancel = () => {
            teardown()
            el.style.height = `${startHeight}px`
        }

        cleanupRef.current = teardown

        if (isTouch) {
            document.addEventListener("touchmove", onMove, { passive: false })
            document.addEventListener("touchend", onUp)
            document.addEventListener("touchcancel", onCancel)
        } else {
            document.addEventListener("mousemove", onMove)
            document.addEventListener("mouseup", onUp)
        }
    }

    return {
        elementRef,
        isDragging,
        isResizing,
        handleMouseDown,
        handleResizeDown,
    }
}

// Helpers déplacés dans `utils/crmCompute.ts` (groupEventsByOwner / computeOverlapGroups)
// pour mémoïsation + tests unitaires + sweep-line O(n log n).

// ==========================================
// 2. SOUS-COMPOSANTS
// ==========================================
interface UnavailabilityCardProps {
    slot: UnavailabilitySlot
    dayStart: Date
    hourHeight: number
}

const UnavailabilityCard = memo(function UnavailabilityCard({
    slot,
    dayStart,
    hourHeight,
}: UnavailabilityCardProps) {
    const dayEnd = endOfDay(dayStart)
    const start =
        new Date(slot.debut) < dayStart ? dayStart : new Date(slot.debut)
    const end = new Date(slot.fin) > dayEnd ? dayEnd : new Date(slot.fin)

    const top = minutesToTopPx(differenceInMinutes(start, dayStart), hourHeight)
    const height = (differenceInMinutes(end, start) / 60) * hourHeight
    if (height <= 0) return null

    return (
        <div
            className="absolute left-0 right-0 z-0 pointer-events-none bg-red-100/40 dark:bg-red-900/10 border-y border-red-200"
            style={{ top: `${top}px`, height: `${height}px` }}
        >
            <svg
                className="w-full h-full text-red-400 opacity-40"
                preserveAspectRatio="none"
            >
                <line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="100%"
                    stroke="currentColor"
                    strokeWidth="1"
                />
                <line
                    x1="100%"
                    y1="0"
                    x2="0"
                    y2="100%"
                    stroke="currentColor"
                    strokeWidth="1"
                />
            </svg>
        </div>
    )
})

interface EventCardProps {
    evt: Event_creation
    dayStart: Date
    hourHeight: number
    widthPercent: number
    leftPercent: number
    updateEvent: (evt: Event_creation) => void
    onClick: () => void
    onDoubleClick?: () => void
}

const EventCard = memo(function EventCard({
    evt,
    dayStart,
    hourHeight,
    widthPercent,
    leftPercent,
    updateEvent,
    onClick,
    onDoubleClick,
}: EventCardProps) {
    const dayEnd = endOfDay(dayStart)
    // safeDate protège contre les dates null/invalides venant de Supabase
    // (sinon format() lève "Invalid time value" et crashe le rendu du jour).
    const eventStart = safeDate(evt.debut) ?? dayStart
    const eventEnd = safeDate(evt.fin) ?? eventStart

    const visibleStart = eventStart < dayStart ? dayStart : eventStart
    const visibleEnd = eventEnd > dayEnd ? dayEnd : eventEnd

    const top = minutesToTopPx(
        differenceInMinutes(visibleStart, dayStart),
        hourHeight
    )
    const height = Math.max(
        20,
        (differenceInMinutes(visibleEnd, visibleStart) / 60) * hourHeight
    )

    const isUnavailable =
        evt.nom === "Non Disponible" || evt.nom === "Indisponible"
    const theme = getEventTheme(evt.nom)

    const { elementRef, isDragging, handleMouseDown, handleResizeDown } =
        useEventDrag(
            evt,
            updateEvent,
            hourHeight,
            differenceInMinutes(eventEnd, eventStart),
            dayStart
        )

    return (
        <div
            ref={elementRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            onClick={(e) => {
                e.stopPropagation()
                if (!isDragging) onClick()
            }}
            onDoubleClick={(e) => {
                e.stopPropagation()
                if (onDoubleClick) onDoubleClick()
            }}
            className={cn(
                // touch-action: le navigateur sait ainsi qu'un geste de
                // défilement démarré sur un RDV appartient au scroll de la
                // grille, et le cède sans attendre le JS — c'est ce qui rend
                // le scroll fluide pendant la fenêtre d'appui long.
                "absolute touch-pan-x touch-pan-y rounded-md border px-2 py-1 text-xs font-medium cursor-pointer transition-colors overflow-hidden z-10",
                theme.bg,
                theme.text,
                theme.borderAll,
                pendingEventClass(evt.confirmed),
                isDragging && "opacity-80 z-40 shadow-xl"
            )}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                width: `calc(${widthPercent}% - 4px)`,
                left: `calc(${leftPercent}% + 2px)`,
            }}
        >
            <div className="flex flex-col h-full relative z-10">
                <div className="font-semibold truncate leading-tight">
                    {evt.description ||
                        (isUnavailable ? "INDISPONIBLE" : "Sans titre")}
                </div>
                <div className="text-[10px] opacity-80">
                    {format(eventStart, "HH:mm")} - {format(eventEnd, "HH:mm")}
                </div>
            </div>
            <div
                data-resize="true"
                onMouseDown={handleResizeDown}
                onTouchStart={handleResizeDown}
                // La barre visible reste fine (6px) mais `after:-inset-y-2`
                // élargit la cible tactile à ~38px — sinon la poignée est
                // injouable au doigt (même pattern que shared/ui/organisms/sidebar).
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-foreground/10 z-30 touch-none after:absolute after:-inset-y-2 after:left-0 after:right-0"
            />
        </div>
    )
})

// ==========================================
// 3. COMPOSANT PRINCIPAL
// ==========================================
interface DayViewProps {
    eventsForCurrentDay: Event_creation[]
    unavailabilities?: UnavailabilitySlot[]
    handleDayDoubleClick?: (date: Date) => void
}

export const DayView = memo(function DayView({
    eventsForCurrentDay,
    unavailabilities = [],
    handleDayDoubleClick,
}: DayViewProps) {
    const {
        HOUR_HEIGHT,
        update_Event,
        scrollToEvent,
        date,
        setDate,
        setCreationevent,
        setCreation,
        setUpdate,
        setEventToEdit,
        search,
    } = useCRMContext()
    const { userFilter } = useCalendarContext()

    const dayStart = startOfDay(date)
    const jourFerie = getJourFerie(date)

    // Ordre des colonnes stable : trié par nom (prénom + nom) plutôt que par
    // l'ordre d'apparition des événements, qui change à chaque mise à jour.
    const ownerColumns = useMemo(() => {
        const grouped = groupEventsByOwner(eventsForCurrentDay)
        const sortByName = (cols: OwnerColumn[]) =>
            cols.sort((a, b) =>
                a.ownerName.localeCompare(b.ownerName, "fr", {
                    sensitivity: "base",
                })
            )

        // Les 4 colonnes fixes ne s'affichent qu'en vue "Toute l'équipe".
        // En vue filtrée (Mon agenda / un commercial précis), on n'affiche que
        // les agendas correspondant aux événements chargés.
        if (userFilter !== "all") {
            return sortByName(grouped)
        }

        // groupEventsByOwner clé par `profile.id` (objet) ou `user_id` (string).
        const byKey = new Map(grouped.map((c) => [c.id, c]))
        const merged: OwnerColumn[] = []

        // Vue "Toute l'équipe" = UNIQUEMENT les agendas fixes (Commercial D, Commercial C,
        // Commercial B), toujours affichés (colonne vide si aucun RDV).
        // Aucune autre personne n'est ajoutée, même si elle a des RDV ce jour-là.
        // `search` sert à récupérer le nom et faire le pont id <-> user_id.
        for (const id of FIXED_OWNER_IDS) {
            const profile = search?.find((u) => u.id === id || u.user_id === id)
            const existing =
                byKey.get(id) ??
                (profile
                    ? (byKey.get(profile.id) ?? byKey.get(profile.user_id))
                    : undefined)
            const name = profile?.name ?? existing?.ownerName ?? "Commercial"
            if (existing) {
                merged.push({ ...existing, ownerName: name })
            } else {
                merged.push({ id, ownerName: name, events: [] })
            }
        }

        // Agendas épinglés (ex. Antoine) : toujours en dernière(s) colonne(s),
        // jamais mélangés au tri alphabétique des 4 agendas fixes ci-dessus.
        const pinnedLast: OwnerColumn[] = []
        for (const id of PINNED_LAST_OWNER_IDS) {
            const profile = search?.find((u) => u.id === id || u.user_id === id)
            const existing =
                byKey.get(id) ??
                (profile
                    ? (byKey.get(profile.id) ?? byKey.get(profile.user_id))
                    : undefined)
            const name = profile?.name ?? existing?.ownerName ?? "Commercial"
            if (existing) {
                pinnedLast.push({ ...existing, ownerName: name })
            } else {
                pinnedLast.push({ id, ownerName: name, events: [] })
            }
        }

        return [...sortByName(merged), ...pinnedLast]
    }, [eventsForCurrentDay, search, userFilter])

    const overlapGroupsByOwner = useMemo(
        () =>
            new Map(
                ownerColumns.map((col) => [
                    col.id,
                    computeOverlapGroups(col.events),
                ])
            ),
        [ownerColumns]
    )

    // Ligne rouge (heure actuelle) : -1 si le jour affiché n'est pas aujourd'hui
    const computeNowMinutes = (d: Date) =>
        isSameDay(new Date(), d)
            ? differenceInMinutes(new Date(), startOfDay(new Date()))
            : -1

    const [nowMinutes, setNowMinutes] = useState(() => computeNowMinutes(date))
    // Recalcule immédiatement au changement de jour (ajustement au rendu)
    const [prevDate, setPrevDate] = useState(date)
    if (prevDate !== date) {
        setPrevDate(date)
        setNowMinutes(computeNowMinutes(date))
    }
    // Rafraîchissement chaque minute (setState différé, hors corps de l'effet)
    useEffect(() => {
        const timer = setInterval(
            () => setNowMinutes(computeNowMinutes(date)),
            60000
        )
        return () => clearInterval(timer)
    }, [date])

    // Double clic dans la grille vide = créer un évent
    const handleGridDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const clickY = e.clientY - rect.top
        const exactDate = addMinutes(
            dayStart,
            VISIBLE_START_HOUR * 60 + (clickY / HOUR_HEIGHT) * 60
        )
        const roundedDate = roundToNearestMinutes(exactDate, {
            nearestTo: 15,
            roundingMethod: "round",
        })

        setDate(roundedDate)
        setCreation(true)
        setUpdate(false)
        setEventToEdit(null)
        setCreationevent(true)
        if (handleDayDoubleClick) handleDayDoubleClick(roundedDate)
    }

    const columnsToRender =
        ownerColumns.length > 0
            ? ownerColumns
            : [{ id: "empty", ownerName: "Mon Agenda", events: [] }]

    return (
        <div className="h-full w-full relative">
            {/* Colonnes par commercial trop serrées pour 375px — la grille
                scrolle horizontalement (déjà tactile nativement), ce fondu
                signale juste qu'il y a plus de contenu à droite. */}
            <div className="lg:hidden pointer-events-none absolute top-0 bottom-0 right-0 w-6 z-50 bg-gradient-to-l from-background to-transparent" />
            <div className="h-full w-full overflow-auto bg-background relative select-none">
                <div className="flex w-full min-h-full">
                    {/* Colonne de gauche (Heures) */}
                    <div className="sticky left-0 z-30 bg-background border-r border-border/40 w-14 shrink-0">
                        <div className="h-10 bg-background border-b border-border/40 sticky top-0 z-30" />
                        {HOURS.map((h) => (
                            <div
                                key={h}
                                style={{ height: `${HOUR_HEIGHT}px` }}
                                className="relative text-[10px] text-muted-foreground text-right pr-2 pt-2"
                            >
                                <span className="-translate-y-1/2 block">
                                    {h.toString().padStart(2, "0")}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Colonnes des agendas (Commerciaux) */}
                    {columnsToRender.map((col, index) => (
                        <div
                            key={col.id}
                            style={{ animationDelay: `${index * 60}ms` }}
                            className="flex flex-col flex-1 min-w-[110px] border-r border-border/20 relative animate-in fade-in slide-in-from-top-2 fill-mode-backwards duration-slow ease-out"
                        >
                            {/* En-tête de la colonne */}
                            {/* z-50 : au-dessus d'un événement en cours de drag
                            (z-40), sinon le RDV déplacé passe devant le bandeau
                            qui indique la colonne. Plafonné à 50 et jamais
                            au-delà : c'est le niveau de la sidebar applicative
                            (drawer, MainLayout) — voir l'`isolate` posé sur le
                            conteneur de contenu, qui garantit le cloisonnement. */}
                            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 flex flex-col shadow-sm">
                                <div className="h-10 flex items-center justify-center gap-2 px-2">
                                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="truncate font-semibold text-xs text-foreground">
                                        {col.ownerName}
                                    </span>
                                </div>
                                {jourFerie && (
                                    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                        <span>Jour férié — {jourFerie}</span>
                                    </div>
                                )}
                            </div>

                            {/* Grille du jour */}
                            <div
                                className="relative w-full overflow-hidden"
                                style={{
                                    height: `${(VISIBLE_END_HOUR - VISIBLE_START_HOUR) * HOUR_HEIGHT}px`,
                                }}
                            >
                                {/* Layer interactif double-clic */}
                                <div
                                    className="absolute inset-0 z-10 cursor-cell"
                                    onDoubleClick={handleGridDoubleClick}
                                />

                                {/* Lignes horizontales de fond */}
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    {HOURS.map((h) => (
                                        <div
                                            key={h}
                                            className="w-full border-b border-border/30"
                                            style={{
                                                height: `${HOUR_HEIGHT}px`,
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Indisponibilités (Croix rouges) */}
                                {unavailabilities.map((slot) => (
                                    <UnavailabilityCard
                                        key={`${slot.debut}-${slot.fin}`}
                                        slot={slot}
                                        dayStart={dayStart}
                                        hourHeight={HOUR_HEIGHT}
                                    />
                                ))}

                                {/* Ligne rouge "Heure actuelle" */}
                                {nowMinutes >= 0 && (
                                    <div
                                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                        style={{
                                            top: `${minutesToTopPx(nowMinutes, HOUR_HEIGHT)}px`,
                                        }}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm" />
                                        <div className="h-[2px] flex-1 bg-red-500" />
                                    </div>
                                )}

                                {/* Événements placés */}
                                {(overlapGroupsByOwner.get(col.id) ?? []).map(
                                    (group) =>
                                        group.map((evt, idx) => (
                                            <EventCard
                                                key={evt.id || evt.debut}
                                                evt={evt}
                                                dayStart={dayStart}
                                                hourHeight={HOUR_HEIGHT}
                                                widthPercent={
                                                    100 / group.length
                                                }
                                                leftPercent={
                                                    (100 / group.length) * idx
                                                }
                                                updateEvent={update_Event}
                                                onClick={() =>
                                                    scrollToEvent(
                                                        evt.id || `${evt.debut}`
                                                    )
                                                }
                                                onDoubleClick={() => {
                                                    setEventToEdit(evt)
                                                    setUpdate(true)
                                                    setCreationevent(true)
                                                }}
                                            />
                                        ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})
