import React, { useState, useRef, useEffect, useMemo, memo } from "react"
import {
    startOfDay,
    endOfDay,
    differenceInMinutes,
    isSameDay,
    addMinutes,
    max as dateMax,
    min as dateMin,
} from "date-fns"
import { toZonedTime, format } from "date-fns-tz"
import { fr } from "date-fns/locale"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Event_creation } from "../../hooks/CRM_hook/use_calendar"
import { cn } from "@/shared/lib/utils"
import { LiquidTabsIndicator } from "@/shared/ui/molecules/liquid-tabs-indicator"
import { getJourFerie } from "@/features/crm/utils/joursFeries"
import { getEventTheme, pendingEventClass } from "@/features/crm/types/calendar"
import { computeOverlapGroups } from "@/features/crm/utils/crmCompute"
import { getCustomerUserId } from "@/features/crm/utils/invariants"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
    buildAllowedOwnerSet,
    isOwnerAllowed,
} from "@/features/crm/utils/calendarConstants"
import {
    createAxisLock,
    createDragActivation,
    getPointerPosition,
    isTouchEvent,
    signalDragActivation,
} from "@/features/crm/utils/dragActivation"

let isGlobalDragging = false // Flag global pour éviter de drag plusieurs évents en même temps

// Plage horaire affichée dans la vue semaine (journée de travail) : les
// événements en dehors restent en base et s'affichent normalement dans les
// vues Jour/Mois, seule cette grille les masque.
const VISIBLE_START_HOUR = 8
const VISIBLE_END_HOUR = 19

// Heures visibles (valeurs stables comme clés React, plutôt que l'index du tableau)
const HOURS = Array.from(
    { length: VISIBLE_END_HOUR - VISIBLE_START_HOUR },
    (_, i) => i + VISIBLE_START_HOUR
)

// Position verticale (px) d'un instant exprimé en minutes depuis minuit,
// recalée sur le début de la plage visible (VISIBLE_START_HOUR) plutôt que
// sur minuit — sinon la grille afficherait 8h en haut mais les événements se
// positionneraient toujours comme si 0h était en haut.
const minutesToTopPx = (minutesFromMidnight: number, hourHeight: number) =>
    (minutesFromMidnight / 60 - VISIBLE_START_HOUR) * hourHeight

// ==========================================
// 🧠 2. HOOK: LOGIQUE DE DRAG & RESIZE
// ==========================================
const useWeekEventInteraction = (
    evt: Event_creation,
    day: Date,
    daysToRender: Date[],
    hourHeight: number,
    timeZone: string,
    update_Event: (evt: Event_creation) => void,
    minutesFromMidnight: number,
    clampedStart: Date,
    initialDuration: number
) => {
    const [duration, setDuration] = useState(initialDuration)

    // Synchroniser la durée locale si l'évent change de l'extérieur, via
    // ajustement pendant le rendu (pattern React) plutôt qu'un useEffect.
    const [prevInitialDuration, setPrevInitialDuration] =
        useState(initialDuration)
    if (prevInitialDuration !== initialDuration) {
        setPrevInitialDuration(initialDuration)
        setDuration(initialDuration)
    }

    // Réinitialise le flag global + retire les listeners si le composant
    // est démonté en plein drag (sinon le flag reste bloqué à true et gèle
    // tout drag-and-drop futur de l'agenda, et les listeners window fuient).
    const cleanupRef = useRef<(() => void) | null>(null)
    useEffect(() => {
        return () => {
            cleanupRef.current?.()
            isGlobalDragging = false
        }
    }, [])

    const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation()
        if (isGlobalDragging) return
        isGlobalDragging = true

        const isTouch = isTouchEvent(e)
        const startPoint = getPointerPosition(e)
        const startY = startPoint.y
        const startX = startPoint.x
        const initialTop = minutesToTopPx(minutesFromMidnight, hourHeight)

        const dayColumnEl = (e.currentTarget as HTMLElement)
            .offsetParent as HTMLElement
        const dayWidth = dayColumnEl ? dayColumnEl.clientWidth : 100

        let lastDeltaMinutes = 0
        let lastDeltaX = 0
        // Un appui long relâché sans le moindre mouvement ne doit rien écrire
        // en base : on distingue « drag armé » de « drag effectif ».
        let hasMoved = false

        // Souris : drag dès 5px, comme avant. Tactile : appui long de 250ms —
        // sans ça, un simple scroll de la grille posé sur un RDV le déplaçait
        // et l'écrivait en base au relâchement.
        const activation = createDragActivation({
            isTouch,
            onActivate: () => {
                // Gel du scroll de page seulement une fois le drag réellement
                // engagé : le poser dès le touchstart saccadait chaque tap et
                // chaque scroll de la grille.
                if (isTouch) {
                    document.body.style.overflow = "hidden"
                    signalDragActivation()
                }
            },
        })

        // Ici le delta horizontal change le RDV de jour : sans verrouillage
        // d'axe, un déplacement vertical qui dérive de quelques pixels décale
        // le rendez-vous d'une colonne.
        const axisLock = createAxisLock()

        const onMove = (moveEvent: MouseEvent | TouchEvent) => {
            const current = getPointerPosition(moveEvent)
            const deltaY = current.y - startY
            const deltaX = current.x - startX

            if (!activation.update(deltaX, deltaY)) return
            // Drag actif : on confisque le geste au scroll de la grille
            // (listener enregistré en `passive: false` plus bas).
            if (isTouch && moveEvent.cancelable) moveEvent.preventDefault()

            axisLock.update(deltaX, deltaY)
            // Tant que l'axe n'est pas tranché, le déplacement horizontal
            // (donc le changement de jour) reste bloqué.
            const appliedDeltaX = axisLock.axis === "x" ? deltaX : 0

            if (deltaY !== 0 || appliedDeltaX !== 0) hasMoved = true
            lastDeltaMinutes = (deltaY / hourHeight) * 60
            lastDeltaX = appliedDeltaX

            const el = document.getElementById(`event-${evt.id ?? evt.debut}`)
            if (el) {
                el.style.top = `${initialTop + deltaY}px`
                el.style.transform = `translateX(${appliedDeltaX}px)`
            }
        }

        const teardown = () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onEnd)
            window.removeEventListener("touchmove", onMove)
            window.removeEventListener("touchend", onEnd)
            window.removeEventListener("touchcancel", onCancel)
            if (isTouch) document.body.style.overflow = ""
            activation.cancel()
            isGlobalDragging = false
            cleanupRef.current = null
        }

        const settlePosition = (keepDeltaMinutes: boolean) => {
            const el = document.getElementById(`event-${evt.id ?? evt.debut}`)
            if (!el) return
            el.style.transform = "none"
            el.style.top = `${minutesToTopPx(
                minutesFromMidnight + (keepDeltaMinutes ? lastDeltaMinutes : 0),
                hourHeight
            )}px`
        }

        const onEnd = () => {
            const isDragging = activation.isActive && hasMoved
            teardown()

            if (isDragging) {
                const colChange = Math.round(lastDeltaX / dayWidth)
                const oldIdx = daysToRender.findIndex((d) => isSameDay(d, day))
                const newIdx = Math.max(
                    0,
                    Math.min(daysToRender.length - 1, oldIdx + colChange)
                )
                const newDay = daysToRender[newIdx]

                const newStart = addMinutes(
                    startOfDay(toZonedTime(newDay, timeZone)),
                    minutesFromMidnight + lastDeltaMinutes
                )
                const newEnd = addMinutes(newStart, duration)

                update_Event({
                    ...evt,
                    // Préserver le propriétaire existant : update_Event écrit
                    // `customer: owner` (FK vers profiles.user_id). Un évènement
                    // chargé porte son owner dans `customer` (objet profil).
                    owner: evt.owner ?? getCustomerUserId(evt.customer),
                    debut: format(newStart, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                    fin: format(newEnd, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                })
            }

            settlePosition(isDragging)
        }

        // Geste repris par le navigateur (scroll natif, appel entrant) : on
        // remet le RDV en place et on ne sauvegarde rien.
        const onCancel = () => {
            teardown()
            settlePosition(false)
        }

        cleanupRef.current = teardown

        if (isTouch) {
            window.addEventListener("touchmove", onMove, { passive: false })
            window.addEventListener("touchend", onEnd)
            window.addEventListener("touchcancel", onCancel)
        } else {
            window.addEventListener("mousemove", onMove)
            window.addEventListener("mouseup", onEnd)
        }
    }

    const onResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation()
        if (isGlobalDragging) return
        isGlobalDragging = true

        const isTouch = isTouchEvent(e)
        const startY = getPointerPosition(e).y
        const startHeight = duration
        // Suivi de la durée courante dans la closure : `duration` (state) est
        // figée à la valeur capturée au début du resize, donc onEnd la lirait
        // stale et ne persisterait jamais la nouvelle taille.
        let latestDuration = startHeight

        const activation = createDragActivation({
            isTouch,
            onActivate: () => {
                if (isTouch) signalDragActivation()
            },
        })

        const onMove = (moveEvent: MouseEvent | TouchEvent) => {
            const deltaY = getPointerPosition(moveEvent).y - startY
            if (!activation.update(0, deltaY)) return
            if (isTouch && moveEvent.cancelable) moveEvent.preventDefault()
            const deltaMinutes = (deltaY / hourHeight) * 60
            latestDuration = Math.max(15, startHeight + deltaMinutes)
            setDuration(latestDuration)
        }

        const teardown = () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onEnd)
            window.removeEventListener("touchmove", onMove)
            window.removeEventListener("touchend", onEnd)
            window.removeEventListener("touchcancel", onCancel)
            activation.cancel()
            isGlobalDragging = false
            cleanupRef.current = null
        }

        const onEnd = () => {
            const wasResizing = activation.isActive
            teardown()

            // Aucun redimensionnement effectif → ne rien sauvegarder.
            if (!wasResizing || latestDuration === startHeight) return

            update_Event({
                ...evt,
                owner: evt.owner ?? getCustomerUserId(evt.customer),
                fin: format(
                    addMinutes(clampedStart, latestDuration),
                    "yyyy-MM-dd'T'HH:mm:ssxxx"
                ),
            })
        }

        const onCancel = () => {
            teardown()
            setDuration(startHeight)
        }

        cleanupRef.current = teardown

        if (isTouch) {
            window.addEventListener("touchmove", onMove, { passive: false })
            window.addEventListener("touchend", onEnd)
            window.addEventListener("touchcancel", onCancel)
        } else {
            window.addEventListener("mousemove", onMove)
            window.addEventListener("mouseup", onEnd)
        }
    }

    return { duration, onDragStart, onResizeStart }
}

// ==========================================
// 🧩 3. SOUS-COMPOSANTS
// ==========================================

// Ligne rouge d'heure actuelle
const CurrentTimeLine = memo(
    ({ dayStart, hourHeight }: { dayStart: Date; hourHeight: number }) => {
        const [nowMinutes, setNowMinutes] = useState(() =>
            differenceInMinutes(new Date(), dayStart)
        )

        useEffect(() => {
            const interval = setInterval(() => {
                setNowMinutes(differenceInMinutes(new Date(), dayStart))
            }, 60000)
            return () => clearInterval(interval)
        }, [dayStart])

        return (
            <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: `${minutesToTopPx(nowMinutes, hourHeight)}px` }}
            >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.5" />
                <div className="h-[1px] flex-1 bg-red-500" />
            </div>
        )
    }
)

interface WeekEventCardProps {
    evt: Event_creation
    day: Date
    dayStart: Date
    dayEnd: Date
    daysToRender: Date[]
    timeZone: string
    hourHeight: number
    update_Event: (evt: Event_creation) => void
    widthPercent: number
    leftPercent: number
    zIndex: number
}

// Carte d'événement
const WeekEventCard = memo(
    ({
        evt,
        day,
        dayStart,
        dayEnd,
        daysToRender,
        timeZone,
        hourHeight,
        update_Event,
        widthPercent,
        leftPercent,
        zIndex,
    }: WeekEventCardProps) => {
        const start = toZonedTime(evt.debut, timeZone)
        const end = toZonedTime(evt.fin ?? evt.debut, timeZone)

        const clampedStart = dateMax([start, dayStart])
        const clampedEnd = dateMin([end, dayEnd])

        const minutesFromMidnight = differenceInMinutes(clampedStart, dayStart)
        const initialDuration = differenceInMinutes(clampedEnd, clampedStart)

        const theme = getEventTheme(evt.nom)
        const isUnavailable =
            evt.nom === "Non Disponible" || evt.nom === "Indisponible"

        const { duration, onDragStart, onResizeStart } =
            useWeekEventInteraction(
                evt,
                day,
                daysToRender,
                hourHeight,
                timeZone,
                update_Event,
                minutesFromMidnight,
                clampedStart,
                initialDuration
            )

        return (
            <div
                id={`event-${evt.id ?? evt.debut}`}
                className={cn(
                    // touch-pan-*: le navigateur sait ainsi qu'un geste de
                    // défilement démarré sur un RDV appartient au scroll de la
                    // grille et le cède sans attendre le JS — indispensable
                    // pour que le scroll reste fluide pendant l'appui long.
                    "absolute touch-pan-x touch-pan-y rounded-md border px-1 py-0.5 text-xs overflow-hidden shadow-sm cursor-move border-l-4 transition-shadow hover:shadow-md hover:z-30",
                    theme.bg,
                    theme.text,
                    theme.borderAll,
                    theme.borderLeft,
                    pendingEventClass(evt.confirmed)
                )}
                style={{
                    top: `${minutesToTopPx(minutesFromMidnight, hourHeight)}px`,
                    height: `${(duration / 60) * hourHeight}px`,
                    width: `${widthPercent}%`,
                    left: `${leftPercent}%`,
                    // Borné à 19 : les cartes empilées d'un groupe de
                    // chevauchement doivent rester sous la ligne « heure
                    // actuelle » (z-20), sinon un créneau chargé la masque.
                    zIndex: Math.min(zIndex, 19),
                }}
                onMouseDown={onDragStart}
                onTouchStart={onDragStart}
                onClick={(e) => e.stopPropagation()}
            >
                {isUnavailable && (
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                        <svg
                            className="w-full h-full text-red-400"
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
                )}
                <div className="relative z-10 flex flex-col h-full pointer-events-none">
                    <div className="font-bold truncate text-[10px] uppercase">
                        {isUnavailable ? "INDISPONIBLE" : evt.nom}
                    </div>
                    <div className="truncate text-[9px] opacity-90 italic">
                        {evt.description}
                    </div>
                    <div className="text-[9px] mt-auto font-medium">
                        {format(clampedStart, "HH:mm")} -{" "}
                        {format(addMinutes(clampedStart, duration), "HH:mm")}
                    </div>
                </div>
                <div
                    onMouseDown={onResizeStart}
                    onTouchStart={onResizeStart}
                    // La barre visible reste fine (6px) mais `after:-inset-y-2`
                    // élargit la cible tactile à ~38px — sinon la poignée est
                    // injouable au doigt.
                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-foreground/5 z-30 touch-none pointer-events-auto after:absolute after:-inset-y-2 after:left-0 after:right-0"
                />
            </div>
        )
    }
)

// ==========================================
// 🚀 4. COMPOSANT PRINCIPAL
// ==========================================
interface WeekViewGridProps {
    daysToRender: Date[]
    date?: Date
    handleDayClick: (day: Date) => void
    handleDayDoubleClick: (
        day: Date,
        e?: React.MouseEvent<HTMLDivElement>
    ) => void
}

export const WeekViewGrid: React.FC<WeekViewGridProps> = ({
    daysToRender,
    date,
    handleDayClick,
    handleDayDoubleClick,
}) => {
    const { events, update_Event, HOUR_HEIGHT, search } = useCRMContext()
    const { user } = useAuth()
    const daysHeaderRef = useRef<HTMLDivElement>(null)

    // Vue SEMAINE : on n'affiche QUE les agendas fixes + le mien (aucune autre
    // personne). On cappe la liste d'événements une fois pour toutes.
    const allowedOwners = useMemo(
        () => buildAllowedOwnerSet(search, user?.user_id),
        [search, user?.user_id]
    )
    const visibleEvents = useMemo(
        () => events.filter((evt) => isOwnerAllowed(evt, allowedOwners)),
        [events, allowedOwners]
    )

    return (
        <div className="h-full flex flex-col border rounded-lg overflow-hidden bg-background relative select-none">
            {/* Sur mobile, 5 colonnes jours ne tiennent pas dans 375px — la
                grille scrolle horizontalement (déjà tactile nativement), ce
                fondu signale juste qu'il y a plus de contenu à droite. */}
            <div className="lg:hidden pointer-events-none absolute top-0 bottom-0 right-0 w-6 z-50 bg-gradient-to-l from-background to-transparent" />
            <div className="flex-1 overflow-auto relative w-full h-full">
                <div className="min-w-max flex flex-col">
                    {/* --- HEADER DES JOURS --- */}
                    {/* z-50 : les cartes d'événement montent à hover:z-30 et un
                        RDV en cours de drag à z-40, le header doit rester
                        strictement au-dessus. Plafonné à 50 et jamais au-delà :
                        c'est le niveau de la sidebar applicative (drawer,
                        MainLayout) — voir l'`isolate` posé sur le conteneur de
                        contenu, qui garantit le cloisonnement. */}
                    <div className="flex border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
                        <div className="w-12 border-r border-border/40 shrink-0 bg-background sticky left-0 z-50" />
                        <div
                            ref={daysHeaderRef}
                            className="relative flex flex-1"
                        >
                            <LiquidTabsIndicator
                                containerRef={daysHeaderRef}
                                activeValue={date ? date.toDateString() : ""}
                                className="inset-y-1 rounded-md"
                            />
                            {daysToRender.map((day, index) => {
                                const isToday = isSameDay(day, new Date())
                                const isSelected = date && isSameDay(day, date)
                                const jourFerie = getJourFerie(day)
                                return (
                                    <div
                                        key={day.toISOString()}
                                        data-state={
                                            isSelected ? "active" : "inactive"
                                        }
                                        onClick={() => handleDayClick(day)}
                                        style={{
                                            animationDelay: `${index * 40}ms`,
                                        }}
                                        className={cn(
                                            "relative z-10 flex-1 min-w-[100px] h-10 flex items-center justify-center gap-1.5 text-sm font-medium border-r border-border/30 last:border-r-0 transition-colors cursor-pointer",
                                            "animate-in fade-in slide-in-from-top-2 fill-mode-backwards duration-slow ease-out",
                                            isSelected
                                                ? "text-sidebar-accent-foreground"
                                                : isToday &&
                                                      "text-primary bg-primary/5 font-bold",
                                            jourFerie &&
                                                !isSelected &&
                                                "bg-amber-50/60 dark:bg-amber-900/10"
                                        )}
                                    >
                                        <span className="capitalize">
                                            {format(day, "EEE d", {
                                                locale: fr,
                                            })}
                                        </span>
                                        {jourFerie && (
                                            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium truncate max-w-[80px]">
                                                {jourFerie}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* --- CORPS DE LA GRILLE --- */}
                    <div className="flex flex-1">
                        {/* Colonne des heures */}
                        <div className="w-12 bg-muted/20 border-r border-border/40 flex flex-col shrink-0 sticky left-0 z-30 bg-background">
                            {HOURS.map((h) => (
                                <div
                                    key={h}
                                    style={{ height: `${HOUR_HEIGHT}px` }}
                                    className="text-[10px] text-muted-foreground text-right pr-2 pt-1"
                                >
                                    {h.toString().padStart(2, "0")}:00
                                </div>
                            ))}
                        </div>

                        {/* Colonnes des Jours */}
                        <div className="flex flex-1 relative">
                            {daysToRender.map((day, index) => {
                                const timeZone =
                                    Intl.DateTimeFormat().resolvedOptions()
                                        .timeZone
                                const dayStart = startOfDay(
                                    toZonedTime(day, timeZone)
                                )
                                const dayEnd = endOfDay(
                                    toZonedTime(day, timeZone)
                                )
                                const isToday = isSameDay(day, new Date())
                                const isSelected = date && isSameDay(day, date)

                                const dayEvents = visibleEvents.filter((evt) =>
                                    isSameDay(
                                        toZonedTime(evt.debut, timeZone),
                                        day
                                    )
                                )
                                const overlapGroups =
                                    computeOverlapGroups(dayEvents)

                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={cn(
                                            "flex-1 min-w-[100px] relative overflow-hidden border-r border-border/30 last:border-r-0",
                                            "animate-in fade-in fill-mode-backwards duration-slow ease-out",
                                            (isSelected || isToday) &&
                                                "bg-primary/[0.02]",
                                            getJourFerie(day) &&
                                                "bg-amber-50/30 dark:bg-amber-900/5"
                                        )}
                                        style={{
                                            height: `${(VISIBLE_END_HOUR - VISIBLE_START_HOUR) * HOUR_HEIGHT}px`,
                                            animationDelay: `${index * 40}ms`,
                                        }}
                                        onClick={() => handleDayClick(day)}
                                        onDoubleClick={(e) =>
                                            handleDayDoubleClick(day, e)
                                        }
                                    >
                                        {/* Lignes de fond (Heures) */}
                                        {HOURS.map((h) => (
                                            <div
                                                key={h}
                                                className="absolute left-0 right-0 border-b border-border/10 pointer-events-none"
                                                style={{
                                                    top: `${(h - VISIBLE_START_HOUR) * HOUR_HEIGHT}px`,
                                                    height: `${HOUR_HEIGHT}px`,
                                                }}
                                            />
                                        ))}

                                        {/* Ligne de l'heure actuelle */}
                                        {isToday && (
                                            <CurrentTimeLine
                                                dayStart={dayStart}
                                                hourHeight={HOUR_HEIGHT}
                                            />
                                        )}

                                        {/* Événements */}
                                        {overlapGroups.map((group) =>
                                            group.map((evt, idx) => (
                                                <WeekEventCard
                                                    key={evt.id ?? evt.debut}
                                                    evt={evt}
                                                    day={day}
                                                    dayStart={dayStart}
                                                    dayEnd={dayEnd}
                                                    daysToRender={daysToRender}
                                                    timeZone={timeZone}
                                                    hourHeight={HOUR_HEIGHT}
                                                    update_Event={update_Event}
                                                    widthPercent={
                                                        100 / group.length
                                                    }
                                                    leftPercent={
                                                        (100 / group.length) *
                                                        idx
                                                    }
                                                    zIndex={10 + idx}
                                                />
                                            ))
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
