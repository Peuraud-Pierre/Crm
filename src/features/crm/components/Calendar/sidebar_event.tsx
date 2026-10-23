import { useState, useMemo, useEffect, useRef } from "react"
import { safeDate } from "@/features/crm/utils/safeDate"
import { getJourFerie } from "@/features/crm/utils/joursFeries"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toZonedTime } from "date-fns-tz"
import { ScrollArea } from "@/shared/ui/atoms/scroll-area"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/shared/ui/atoms/dialog"
import {
    Edit,
    Trash2,
    Clock,
    CalendarIcon,
    X,
    CheckCircle2,
    XCircle,
    Users,
    Plus,
} from "lucide-react"

import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useCalendarContext } from "../../context/CalendarContext"
import { type Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import {
    isCustomerObject,
    getCustomerUserId,
} from "@/features/crm/utils/invariants"
import { cn } from "@/shared/lib/utils"
import { toast } from "sonner"
import { getEventTheme, pendingEventClass } from "@/features/crm/types/calendar"

export const CalendarSidebar = () => {
    const { isSidebarOpen, setIsSidebarOpen, date } = useCalendarContext()
    const {
        events,
        setEventToEdit,
        setCreationevent,
        setUpdate,
        deleteEvent,
        update_Event,
        confirm_event,
        setFicheclient,
        setClientToOpen,
        clients,
        setSelectedEventInfo,
    } = useCRMContext()

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Événements du jour sélectionné, triés par heure de début.
    // Dérivé via useMemo (pas de state local + useEffect : évite un
    // re-render superflu et le set-state direct dans un effet).
    const localEvents = useMemo(
        () =>
            events
                .filter((evt) => {
                    const d = safeDate(evt.debut)
                    return d ? d.toDateString() === date.toDateString() : false
                })
                .sort((a, b) => {
                    const dateA = safeDate(a.debut)
                    const dateB = safeDate(b.debut)
                    if (!dateA || !dateB) return 0
                    return dateA.getTime() - dateB.getTime()
                }),
        [events, date]
    )

    // ÉTATS POUR LA POPUP NO-SHOW
    const [isStatusPopupOpen, setIsStatusPopupOpen] = useState(false)
    const [eventToUpdate, setEventToUpdate] = useState<Event_creation | null>(
        null
    )
    const [noShowReason, setNoShowReason] = useState("")

    // Jour férié du jour affiché (string | null) ; calculé une fois.
    const jourFerie = getJourFerie(date)

    // Reste monté le temps de l'animation de sortie : sans ça, isSidebarOpen
    // passant à false démonte immédiatement le composant et coupe le
    // slide-out/fade-out avant qu'il n'ait pu jouer.
    const [shouldRender, setShouldRender] = useState(isSidebarOpen)
    // Largeur cible sur desktop, appliquée un rendu APRÈS le montage : si on
    // la mettait à jour dans le même effet que shouldRender, l'élément
    // apparaîtrait déjà à sa largeur finale dès sa toute première peinture et
    // la transition CSS n'aurait rien à animer (même piège que pour la
    // pastille verte des onglets).
    const [isExpanded, setIsExpanded] = useState(false)
    const rafRef = useRef(0)

    useEffect(() => {
        if (!isSidebarOpen) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- collapse la largeur sur fermeture, l'élément est déjà peint à 350px donc la transition anime bien
            setIsExpanded(false)
            return
        }
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resynchronise le montage sur la réouverture, ne peut pas être dérivé au rendu
        setShouldRender(true)
        // Double rAF : garantit qu'un vrai frame peint à largeur 0 a eu lieu
        // avant de passer à 350px. Chaîner deux useEffect ne suffit pas —
        // React peut flusher les deux mises à jour avant que le navigateur
        // n'ait eu l'occasion de peindre quoi que ce soit entre les deux.
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
                setIsExpanded(true)
            })
            rafRef.current = raf2
        })
        rafRef.current = raf1
        return () => cancelAnimationFrame(rafRef.current)
    }, [isSidebarOpen])

    if (!shouldRender) return null

    // GESTION DU CLIC SUR LE BOUTON SHOW/NO-SHOW
    const handlePresenceClick = async (evt: Event_creation) => {
        if (evt.show !== false) {
            // S'il est présent (Show) et qu'on veut le passer en Absent (No-Show) -> POPUP
            setEventToUpdate(evt)
            setNoShowReason("") // Reset la raison
            setIsStatusPopupOpen(true)
        } else {
            // S'il est déjà Absent (No-Show) et qu'on le remet en Présent (Show) -> DIRECT
            try {
                // Préserver le propriétaire (FK profiles.user_id) ; sinon
                // update_Event écrase `customer` car evt.owner est absent.
                await update_Event({
                    ...evt,
                    owner: evt.owner ?? getCustomerUserId(evt.customer),
                    show: true,
                })
                toast.success("Client marqué comme Présent")
            } catch {
                toast.error("Erreur lors de la mise à jour")
            }
        }
    }

    // CONFIRMATION DE LA POPUP NO-SHOW
    const confirmNoShow = async () => {
        if (!eventToUpdate || !noShowReason) return

        try {
            // On ajoute la raison (motif_absence) ou on l'ajoute à la description selon l'API
            // Ici on ajoute "motif_absence" dans l'objet envoyé
            await update_Event({
                ...eventToUpdate,
                owner:
                    eventToUpdate.owner ??
                    getCustomerUserId(eventToUpdate.customer),
                show: false,
                why: noShowReason,
            } as Event_creation & { why?: string })

            toast.success("Client marqué comme Absent")
            setIsStatusPopupOpen(false)
            setEventToUpdate(null)
        } catch {
            toast.error("Erreur lors de la mise à jour")
        }
    }

    const handleOpenClientProfile = (
        e: React.MouseEvent,
        clientProfile: Client | null | undefined
    ) => {
        e.stopPropagation()
        if (!clientProfile) return
        const fullClient = clients?.find((c) => c.id === clientProfile.id)
        setIsSidebarOpen(false)
        setFicheclient(true)
        setClientToOpen?.(
            (fullClient ?? clientProfile) as unknown as Parameters<
                NonNullable<typeof setClientToOpen>
            >[0]
        )
    }

    const groupedEvents = localEvents.reduce(
        (acc, evt) => {
            const assignee = isCustomerObject(evt.customer)
                ? evt.customer.full_name || "Non assigné"
                : "Non assigné"
            if (!acc[assignee]) acc[assignee] = []
            acc[assignee].push(evt)
            return acc
        },
        {} as Record<string, Event_creation[]>
    )

    return (
        <>
            {/* POPUP DE MOTIF D'ABSENCE (NO-SHOW)
                Dialog du design system plutôt qu'un overlay `fixed` maison :
                portalisé dans document.body, donc à l'abri des contextes
                d'empilement locaux — l'ancien `fixed inset-0 z-[100]` était
                rendu sous le wrapper `blur-md` de CalendarTab, dont le `filter`
                devenait son bloc conteneur et le recadrait sur le calendrier. */}
            <Dialog
                open={isStatusPopupOpen}
                onOpenChange={setIsStatusPopupOpen}
            >
                <DialogContent
                    className="max-w-[400px] rounded-xl"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle>Motif du No-Show</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <label className="text-sm font-medium text-muted-foreground">
                            Veuillez indiquer la raison de l'absence :
                        </label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                            value={noShowReason}
                            onChange={(e) => setNoShowReason(e.target.value)}
                        >
                            <option value="" disabled>
                                Sélectionnez un motif
                            </option>
                            <option value="Oubli du rendez-vous">
                                Oubli du rendez-vous
                            </option>
                            <option value="Annulation de dernière minute">
                                Annulation de dernière minute
                            </option>
                            <option value="Imprévu professionnel">
                                Imprévu professionnel
                            </option>
                            <option value="Urgence personnelle / Santé">
                                Urgence personnelle / Santé
                            </option>
                            <option value="Injoignable">
                                Injoignable / Ne répond pas
                            </option>
                            <option value="Autre">Autre</option>
                        </select>

                        <DialogFooter className="gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsStatusPopupOpen(false)
                                }}
                            >
                                Annuler
                            </Button>
                            <Button
                                disabled={!noShowReason}
                                onClick={confirmNoShow}
                            >
                                Confirmer l'absence
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <div
                className={cn(
                    // Mobile : overlay par-dessus le calendrier (ne touche pas son layout).
                    // z-50 et pas au-delà : c'est le niveau de la sidebar
                    // applicative (drawer, MainLayout) — le panneau ne doit
                    // jamais passer devant elle.
                    "absolute inset-0 z-50",
                    // Desktop : vrai membre du flex row dont on anime la largeur — le calendrier
                    // (flex-1, sibling) se redimensionne donc en continu avec elle, au lieu de sauter
                    // d'un coup au (dé)montage.
                    "md:static md:z-0 md:shrink-0 md:h-full md:overflow-hidden",
                    // will-change-[width] (pas -transform) : c'est bien la largeur
                    // qui s'anime ici, pas une transform — l'ancien hint ne
                    // correspondait plus à rien depuis le passage au transition-[width].
                    "will-change-[width] duration-slower ease-emphasized md:transition-[width]",
                    isExpanded ? "md:w-[350px]" : "md:w-0",
                    isSidebarOpen
                        ? "animate-in fade-in slide-in-from-right-12 md:animate-none"
                        : "animate-out fade-out slide-out-to-right-12 md:animate-none"
                )}
                onAnimationEnd={() => {
                    if (!isSidebarOpen) setShouldRender(false)
                }}
                onTransitionEnd={(e) => {
                    if (e.propertyName === "width" && !isSidebarOpen)
                        setShouldRender(false)
                }}
            >
                {/* Largeur fixe : le panneau ne se compresse pas pendant que le
                    conteneur parent anime sa largeur de 0 à 350px, il est juste révélé.
                    [contain:layout_paint] : isole le layout/paint de la liste de RDV
                    de celui du parent animé — sans ça, plus il y a de cartes, plus le
                    navigateur les recalcule à chaque frame de la transition de largeur
                    (perceptible en ouverture/fermeture avec beaucoup de RDV). */}
                <div className="flex flex-col h-full w-full md:w-[350px] bg-background md:border-l md:border-border/40 md:bg-muted/10 overflow-hidden shadow-xl md:shadow-none [contain:layout_paint]">
                    <div className="shrink-0 bg-background/80 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between gap-2 overflow-hidden w-full">
                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                            <h3 className="text-sm font-bold text-foreground capitalize flex items-center gap-1.5 truncate">
                                <CalendarIcon className="h-4 w-4 shrink-0 text-primary hidden md:block" />
                                <span className="truncate">
                                    {format(date, "EEEE d MMMM", {
                                        locale: fr,
                                    })}
                                </span>
                            </h3>

                            <div className="flex items-center gap-1.5 mt-0.5 w-full min-w-0 overflow-hidden">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tighter shrink-0">
                                    {localEvents.length}{" "}
                                    {localEvents.length > 1
                                        ? "événements"
                                        : "événement"}
                                </span>

                                {jourFerie && (
                                    <span
                                        className="text-[10px] text-amber-600 font-semibold uppercase tracking-tighter truncate flex-1 min-w-0"
                                        title={jourFerie}
                                    >
                                        — {jourFerie}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full bg-muted/50 md:hidden"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Variante arbitraire nécessaire : Radix enveloppe le contenu
                        du Viewport dans une div en `display: table` (style inline),
                        qui s'élargit à la largeur min-content des cartes — un nom
                        de client long (`truncate` = nowrap) l'étirait au-delà des
                        350px et le bord droit des cartes (bouton Show/No-show,
                        icônes modifier/supprimer) sortait du panneau, coupé par
                        l'overflow-hidden. `block!` (important) bat le style inline.
                        Pas dans l'atome ScrollArea : le Kanban des tickets, en
                        défilement horizontal, a besoin du `display: table`. */}
                    <ScrollArea className="flex-1 w-full max-w-full overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:block!">
                        <div className="p-4 pr-5 pb-28 md:pb-4 flex flex-col gap-6 w-full max-w-full overflow-hidden">
                            {/* BOUTON CRÉER UN ÉVÉNEMENT */}
                            <Button
                                className="w-full flex items-center justify-center gap-2 shadow-sm font-bold"
                                onClick={() => {
                                    setUpdate(false)
                                    setEventToEdit(null) // Réinitialise pour avoir un formulaire vierge
                                    setCreationevent(true)
                                }}
                            >
                                <Plus className="h-4 w-4" />
                                Nouvel événement
                            </Button>

                            {Object.entries(groupedEvents).map(
                                ([assignee, eventsGroup]) => (
                                    <div
                                        key={assignee}
                                        className="space-y-3 w-full max-w-full min-w-0"
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="h-px flex-1 bg-border/80"></div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate max-w-[150px] shrink-0">
                                                {assignee}
                                            </span>
                                            <div className="h-px flex-1 bg-border/80"></div>
                                        </div>

                                        {eventsGroup.map((evt, index) => {
                                            const theme = getEventTheme(evt.nom)
                                            return (
                                                <div
                                                    key={evt.id || evt.debut}
                                                    onClick={() =>
                                                        setSelectedEventInfo(
                                                            evt
                                                        )
                                                    }
                                                    style={{
                                                        animationDelay: `${Math.min(index * 130, 1040)}ms`,
                                                    }}
                                                    className={cn(
                                                        "p-4 rounded-xl border-l-[6px] transition-shadow bg-card border hover:shadow-md cursor-pointer flex flex-col gap-3 w-full max-w-full overflow-hidden min-w-0",
                                                        "animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-base ease-out",
                                                        theme.borderLeft,
                                                        theme.bg,
                                                        pendingEventClass(
                                                            evt.confirmed
                                                        )
                                                    )}
                                                >
                                                    <div className="flex justify-between items-start gap-4 w-full min-w-0">
                                                        <span
                                                            className={cn(
                                                                "text-[10px] font-black uppercase tracking-widest break-words flex-1 mt-1 min-w-0",
                                                                theme.text
                                                            )}
                                                        >
                                                            {evt.nom}
                                                        </span>
                                                        <div className="flex gap-1 shrink-0 -mr-2">
                                                            {evt.confirmed ===
                                                                false && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-success hover:text-success/80"
                                                                    title="Confirmer le rendez-vous"
                                                                    onClick={(
                                                                        e
                                                                    ) => {
                                                                        e.stopPropagation()
                                                                        confirm_event(
                                                                            evt
                                                                        )
                                                                    }}
                                                                >
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.stopPropagation()
                                                                    setCreationevent(
                                                                        true
                                                                    )
                                                                    setUpdate(
                                                                        true
                                                                    )
                                                                    setEventToEdit(
                                                                        evt
                                                                    )
                                                                }}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 hover:text-destructive"
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.stopPropagation()
                                                                    if (
                                                                        confirm(
                                                                            "Supprimer ?"
                                                                        )
                                                                    )
                                                                        deleteEvent(
                                                                            evt.id!
                                                                        )
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <h4 className="text-[15px] font-bold text-foreground line-clamp-3 break-words w-full min-w-0">
                                                        {evt.description ||
                                                            "Sans titre"}
                                                    </h4>

                                                    {evt.clientProfile && (
                                                        <div
                                                            className="flex items-center gap-2 text-primary cursor-pointer w-full min-w-0"
                                                            onClick={(e) =>
                                                                handleOpenClientProfile(
                                                                    e,
                                                                    evt.clientProfile
                                                                )
                                                            }
                                                        >
                                                            <Users className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="text-[11px] font-bold hover:underline truncate flex-1 min-w-0">
                                                                Client :{" "}
                                                                {
                                                                    evt
                                                                        .clientProfile
                                                                        .nom
                                                                }
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between gap-2 mt-1 w-full min-w-0">
                                                        <div className="text-xs text-muted-foreground font-medium flex items-center shrink-0">
                                                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                                                            {format(
                                                                toZonedTime(
                                                                    evt.debut,
                                                                    timeZone
                                                                ),
                                                                "HH:mm"
                                                            )}
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handlePresenceClick(
                                                                    evt
                                                                )
                                                            }}
                                                            className={cn(
                                                                "h-7 px-3 rounded-full border-none shadow-none text-[10px] font-bold uppercase shrink-0",
                                                                evt.show !==
                                                                    false
                                                                    ? "bg-emerald-500/20 text-emerald-600"
                                                                    : "bg-amber-500/20 text-amber-600"
                                                            )}
                                                        >
                                                            {evt.show !==
                                                            false ? (
                                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                                            ) : (
                                                                <XCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                                            )}
                                                            {evt.show === false
                                                                ? evt.why
                                                                : "Show"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            )}

                            {localEvents.length === 0 && (
                                <div className="text-center text-sm text-muted-foreground mt-2">
                                    Aucun événement pour ce jour
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </>
    )
}
