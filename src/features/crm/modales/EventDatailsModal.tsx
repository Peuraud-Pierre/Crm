import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useCalendarContext } from "@/features/crm/context/CalendarContext"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import type React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toZonedTime } from "date-fns-tz"
import { Button } from "@/shared/ui/atoms/button"
// 1. Ajout de Trash2 dans les imports
import {
    CalendarIcon,
    Clock,
    Users,
    User,
    AlignLeft,
    Edit,
    Trash2,
    ArrowRight,
    CheckCircle,
    AlertCircle,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getCustomerName } from "@/features/crm/utils/invariants"
import { getEventTheme } from "@/features/crm/utils/eventTypes"
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/atoms/dialog"

export const EventDetailsModal = () => {
    const {
        selectedEventInfo,
        setSelectedEventInfo,
        setEventToEdit,
        setCreationevent,
        setUpdate,
        clients,
        setFicheclient,
        setClientToOpen,
        // 2. Récupération de deleteEvent
        deleteEvent,
        confirm_event,
    } = useCRMContext()

    const { setIsSidebarOpen, setDate, setCurrentMonth, setCalendarView } =
        useCalendarContext()

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Escape, clic à l'extérieur, piège de focus et restitution du focus sont
    // gérés par Radix (Dialog) — plus de listener clavier maison.

    if (!selectedEventInfo) return null

    // Customer = utilisateur/commercial auquel l'événement est rattaché
    // (jointure `customer:profiles`). Peut être un objet CRMUser ou une string.
    const customerName = getCustomerName(selectedEventInfo.customer, "")

    // Place le calendrier sur le jour de l'événement (vue jour) et ferme la modale.
    const goToEventDay = () => {
        const eventDate = new Date(selectedEventInfo.debut)
        if (isNaN(eventDate.getTime())) return
        setDate(eventDate)
        setCurrentMonth(eventDate)
        setCalendarView("day")
        setIsSidebarOpen(false)
        setSelectedEventInfo(null)
    }

    const handleOpenClientProfile = (
        e: React.MouseEvent,
        clientProfile: Client | null | undefined
    ) => {
        e.stopPropagation()
        if (!clientProfile) {
            setSelectedEventInfo(null)
            return
        }
        type ClientToOpenArg = Parameters<
            NonNullable<typeof setClientToOpen>
        >[0]
        const fullClient = clients?.find((c) => c.id === clientProfile.id)
        // Fermer la sidebar mobile avant d'ouvrir la fiche
        setIsSidebarOpen(false)
        setSelectedEventInfo(null)
        if (fullClient) {
            setFicheclient(true)
            setClientToOpen?.(fullClient as unknown as ClientToOpenArg)
        } else {
            const clientData: Client = { ...clientProfile }
            if (typeof clientData.brief === "string") {
                try {
                    clientData.brief = JSON.parse(clientData.brief)
                } catch (error) {
                    console.error("Erreur parsing brief :", error)
                }
            }
            setFicheclient(true)
            setClientToOpen?.(clientData as unknown as ClientToOpenArg)
        }
    }

    // Dialog du design system plutôt qu'un overlay `fixed` maison : il est
    // portalisé dans document.body, donc immunisé aux contextes d'empilement
    // locaux — l'ancien `fixed inset-0 z-[100]` était rendu sous le wrapper
    // `blur-md` de CalendarTab, dont le `filter` devenait son bloc conteneur
    // et le recadrait sur la carte du calendrier.
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) setSelectedEventInfo(null)
            }}
        >
            <DialogContent
                className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0"
                aria-describedby={undefined}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
                    <DialogTitle className="text-lg font-bold text-foreground capitalize flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        Détails du rendez-vous
                    </DialogTitle>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
                                    getEventTheme(selectedEventInfo.nom).badge
                                )}
                            >
                                {selectedEventInfo.nom || "Événement"}
                            </span>
                            {selectedEventInfo.confirmed === false && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500">
                                    <AlertCircle className="h-3 w-3" />À
                                    confirmer
                                </span>
                            )}
                        </div>
                        <h3 className="text-xl font-bold mt-3 leading-tight">
                            {selectedEventInfo.description || "Sans titre"}
                        </h3>
                    </div>

                    <div className="grid gap-4">
                        <div
                            className="flex items-center gap-3 text-muted-foreground cursor-pointer group"
                            onClick={goToEventDay}
                            title="Afficher ce jour dans le calendrier"
                        >
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                                    Horaires
                                    <span className="text-[11px] font-normal text-primary opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5">
                                        · Voir ce jour
                                        <ArrowRight className="h-3 w-3" />
                                    </span>
                                </p>
                                <p className="text-sm">
                                    {format(
                                        toZonedTime(
                                            selectedEventInfo.debut,
                                            timeZone
                                        ),
                                        "EEEE d MMMM yyyy",
                                        { locale: fr }
                                    )}
                                    <br />
                                    De{" "}
                                    {format(
                                        toZonedTime(
                                            selectedEventInfo.debut,
                                            timeZone
                                        ),
                                        "HH:mm"
                                    )}{" "}
                                    à{" "}
                                    {format(
                                        toZonedTime(
                                            selectedEventInfo.fin ||
                                                selectedEventInfo.debut,
                                            timeZone
                                        ),
                                        "HH:mm"
                                    )}
                                </p>
                            </div>
                        </div>

                        {selectedEventInfo.clientProfile && (
                            <div
                                className="flex items-center gap-3 text-muted-foreground cursor-pointer group"
                                onClick={(e) =>
                                    handleOpenClientProfile(
                                        e,
                                        selectedEventInfo.clientProfile
                                    )
                                }
                            >
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                        Client concerné
                                    </p>
                                    <p className="text-sm font-bold text-primary group-hover:underline">
                                        {selectedEventInfo.clientProfile.nom}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Customer = utilisateur/commercial rattaché à l'événement */}
                        {customerName && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">
                                        Rattaché à
                                    </p>
                                    <p className="text-sm font-bold">
                                        {customerName}
                                    </p>
                                </div>
                            </div>
                        )}

                        {selectedEventInfo.lieu && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <AlignLeft className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">
                                        Lieu / Notes
                                    </p>
                                    <p className="text-sm">
                                        {selectedEventInfo.lieu}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Modification du bas de la modale (flex justify-between) */}
                <div className="bg-muted/20 border-t border-border/50">
                    {selectedEventInfo.confirmed === false && (
                        <div className="px-6 pt-4">
                            <Button
                                className="w-full bg-success hover:bg-success/90 text-success-foreground"
                                onClick={() => {
                                    confirm_event(selectedEventInfo)
                                    setSelectedEventInfo(null)
                                }}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirmer le rendez-vous
                            </Button>
                        </div>
                    )}

                    <div className="px-6 py-4 flex items-center justify-between gap-2">
                        {/* Bouton Supprimer à gauche */}
                        <Button
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                                if (
                                    confirm(
                                        "Voulez-vous vraiment supprimer cet événement ?"
                                    )
                                ) {
                                    if (selectedEventInfo.id) {
                                        deleteEvent(selectedEventInfo.id)
                                    }
                                    setSelectedEventInfo(null)
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </Button>

                        {/* Regroupement des boutons de droite */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedEventInfo(null)}
                            >
                                Fermer
                            </Button>
                            <Button
                                onClick={() => {
                                    const event = selectedEventInfo
                                    setSelectedEventInfo(null)
                                    setCreationevent(true)
                                    setUpdate(true)
                                    setEventToEdit(event)
                                }}
                            >
                                <Edit className="w-4 h-4 mr-2" /> Modifier
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
