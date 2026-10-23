import { useState } from "react"

import {
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetClose,
} from "@/shared/ui/atoms/sheet"

import { Button } from "@/shared/ui/atoms/button"

import { Badge } from "@/shared/ui/atoms/badge"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"

import { Separator } from "@/shared/ui/atoms/separator"

import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar"

import { ScrollArea } from "@/shared/ui/atoms/scroll-area"

import {
    Mail,
    Calendar,
    CheckCircle2,
    ArrowRightLeft,
    UserCheck,
    Hash,
    AlertCircle,
    Circle,
    AlertTriangle,
    ArrowUpCircle,
    ArrowDownCircle,
    MinusCircle,
    Info,
    MessageSquare,
    Archive,
    X,
    RotateCcw,
    Box,
    Eye,
} from "lucide-react"

import { useTicketContext } from "../../context/TicketContext"

import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

import { formatDate, CategoryIcon } from "../../ticket.helper"

import { TICKET_THEME } from "../../ticket.theme"

import type { Ticket, TicketPriority } from "../types"

interface TicketInfoPanelProps {
    ticket: Ticket

    isChatOpen: boolean

    onToggleChat: () => void

    onCloseSheet: () => void
}

export function TicketInfoPanel({
    ticket,
    isChatOpen,
    onToggleChat,
    onCloseSheet,
}: TicketInfoPanelProps) {
    const { updateTicket, initializeChat } = useTicketContext();

    const { user } = useAuth()

    const [isUpdating, setIsUpdating] = useState(false)

    const isAssignedToMe = user && ticket.assigned_to === user.user_id
    const isCreatedByMe = user && ticket.created_by === user.user_id;

    const isClaimable = !ticket.assigned_to && !isCreatedByMe 

    const isResolved = ticket.status === "résolu"

    const isArchived = ticket.status === "clos"

    const assignedName =
        ticket.assigned_to === user?.user_id
            ? user?.user_metadata?.full_name || "Moi"
            : ticket.assigned_profile?.full_name || "Inconnu"

    const priorityKey = (ticket.priority ||
        "moyenne") as keyof typeof TICKET_THEME.card

    const cardTheme =
        TICKET_THEME.card[priorityKey] || TICKET_THEME.card.moyenne

    const handleAction = async (action: () => Promise<void>) => {
        if (isUpdating) return

        setIsUpdating(true)

        try {
            await action()
        } catch (error) {
            console.error("Action failed", error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handlePriorityChange = (value: string) => {
        updateTicket({ ...ticket, priority: value as TicketPriority })
    }

    const handleAssignToMe = () =>
    handleAction(async () => {
        if (!user || !ticket.id) return

        const optimisticProfile = {
            id: user.user_id,
            user_id: user.user_id,
            full_name: user.user_metadata?.full_name || "Moi",
            email: user.email,
        }

        // 1. Mise à jour du ticket (Assignation)
        await updateTicket({
            ...ticket,
            assigned_to: user.user_id,
            status: "en_cours",
            assigned_profile: optimisticProfile,
            priority: ticket.priority === "nouveau" ? "moyenne" : ticket.priority,
        })

        // 2. Création de la session de chat en base de données
        // On utilise l'ID du créateur du ticket (ticket.created_by) comme propriétaire (owner)
        try {
            await initializeChat(ticket.id, ticket.created_by || "")
        } catch (err) {
            console.error("Erreur lors de l'initialisation du chat:", err)
            // On ne bloque pas l'UI car le ticket est déjà assigné, 
            // mais on log l'erreur pour le debug
        }

        // 3. Ouvrir le panneau de chat automatiquement pour le technicien
        if (!isChatOpen) onToggleChat()
    })

    const handleResolveTicket = () =>
        handleAction(async () => {
            await updateTicket({ ...ticket, status: "résolu" })
        })

    const handleReopenTicket = () =>
        handleAction(async () => {
            await updateTicket({ ...ticket, status: "en_cours" })
        })

    const handleArchiveTicket = () =>
        handleAction(async () => {
            await updateTicket({ ...ticket, status: "clos" })

            onCloseSheet()
        })

    return (
        <div className="flex flex-col h-full bg-card dark:bg-slate-950 relative w-full overflow-hidden">
            {/* HEADER */}

            <SheetHeader className="px-6 py-5 border-b dark:border-slate-800 sticky top-0 z-10 bg-card dark:bg-slate-950 flex flex-row items-start justify-between space-y-0 shrink-0">
                <div className="space-y-4 flex-1 mr-4 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Badge
                            variant="secondary"
                            className="px-2 py-0.5 h-6 text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 border-0 rounded-md"
                        >
                            <Hash size={10} className="mr-1" />

                            {ticket.id?.toString().slice(-4)}
                        </Badge>

                        <div className="flex items-center gap-1.5 px-2 py-0.5 h-6 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <CategoryIcon category={ticket.category} />

                            <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 tracking-wide">
                                {ticket.category}
                            </span>
                        </div>

                        <Badge
                            variant="outline"
                            className={`px-2 py-0.5 h-6 text-[10px] font-bold uppercase tracking-wide border rounded-md ${TICKET_THEME.colors.statusBadge[ticket.status as keyof typeof TICKET_THEME.colors.statusBadge] || TICKET_THEME.colors.statusBadge.ouvert}`}
                        >
                            {ticket.status?.replace("_", " ")}
                        </Badge>
                    </div>

                    <SheetTitle className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-50 tracking-tight break-words">
                        {ticket.title}
                    </SheetTitle>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <SheetClose className="rounded-sm opacity-70 hover:opacity-100 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X className="h-5 w-5" />
                    </SheetClose>
                </div>
            </SheetHeader>

            {/* CONTENT */}

            <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-950/50 w-full">
                <div className="p-6 space-y-8 w-full max-w-full">
                    <section className="space-y-3 w-full min-w-0">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            Description
                        </h4>

                        <div
                            className={`

                            text-sm text-slate-700 dark:text-slate-300 leading-relaxed

                            whitespace-pre-wrap break-words max-w-full

                            p-4 rounded-lg border shadow-sm

                            ${TICKET_THEME.card.moyenne.bg} ${TICKET_THEME.card.moyenne.border}

                        `}
                        >
                            {ticket.description || (
                                <span className="text-slate-400 italic flex items-center gap-2">
                                    <Info size={14} /> Aucune description.
                                </span>
                            )}
                        </div>
                    </section>

                    {(!isCreatedByMe) && !isArchived && (
                        <>
                            <Separator className="bg-slate-200 dark:bg-slate-800" />

                            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <AlertCircle size={12} /> Priorité
                            </label>

                            <Select
                                value={ticket.priority || "moyenne"}
                                onValueChange={handlePriorityChange}
                                disabled={isArchived}
                            >
                                <SelectTrigger
                                    className={`${TICKET_THEME.input.base} h-9 focus:ring-slate-400 dark:focus:ring-slate-700`}
                                >
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="nouveau">
                                        <div className="flex items-center gap-2">
                                            <Circle
                                                size={14}
                                                className="text-purple-500"
                                            />
                                            <span>Nouveau</span>
                                        </div>
                                    </SelectItem>

                                    <SelectItem value="urgente">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle
                                                size={14}
                                                className="text-red-500"
                                            />
                                            <span>Urgente</span>
                                        </div>
                                    </SelectItem>

                                    <SelectItem value="haute">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpCircle
                                                size={14}
                                                className="text-orange-500"
                                            />
                                            <span>Haute</span>
                                        </div>
                                    </SelectItem>

                                    <SelectItem value="moyenne">
                                        <div className="flex items-center gap-2">
                                            <ArrowDownCircle
                                                size={14}
                                                className="text-blue-500"
                                            />
                                            <span>Moyenne</span>
                                        </div>
                                    </SelectItem>

                                    <SelectItem value="basse">
                                        <div className="flex items-center gap-2">
                                            <MinusCircle
                                                size={14}
                                                className="text-slate-500"
                                            />
                                            <span>Basse</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </section>
                    </>
                )}

                <Separator className="bg-slate-200 dark:bg-slate-800" />

                    <section className="space-y-3 w-full min-w-0">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Demandeur
                        </h4>

                        <div
                            className={`flex flex-col xs:flex-row items-start gap-4 p-4 rounded-xl border shadow-sm transition-colors ${cardTheme.bg} ${cardTheme.border}`}
                        >
                            <Avatar
                                className={`h-10 w-10 border ${cardTheme.border} shrink-0`}
                            >
                                <AvatarFallback
                                    className={`${cardTheme.avatarBg} text-sm font-bold`}
                                >
                                    {ticket.profiles?.full_name?.[0]?.toUpperCase() ||
                                        "U"}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 space-y-1 min-w-0 w-full">
                                <div className="flex justify-between items-start gap-2">
                                    <span
                                        className={`text-sm font-semibold block truncate ${cardTheme.text}`}
                                    >
                                        {ticket.profiles?.full_name ||
                                            "Inconnu"}
                                    </span>

                                    <Badge
                                        variant="secondary"
                                        className={`text-[10px] h-5 border-0 shrink-0 ${cardTheme.badge}`}
                                    >
                                        {ticket.from}
                                    </Badge>
                                </div>

                                <div
                                    className={`flex items-center gap-2 text-xs ${cardTheme.mutedText}`}
                                >
                                    <Mail size={12} className="shrink-0" />

                                    <span className="truncate">
                                        {ticket.profiles?.email ||
                                            "Pas d'email"}
                                    </span>
                                </div>

                                <div
                                    className={`flex items-center gap-2 text-xs pt-1 ${cardTheme.mutedText} opacity-80`}
                                >
                                    <Calendar size={12} className="shrink-0" />

                                    <span>{formatDate(ticket.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </ScrollArea>

            {/* FOOTER : Responsive stack */}

            <SheetFooter className="p-4 sm:p-5 border-t dark:border-slate-800 bg-card dark:bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sticky bottom-0 z-10 w-full shrink-0">
                <div className="flex items-center min-w-0">
                    {ticket.assigned_to ? (
                        <div className="flex items-center gap-3 pl-1 pr-4 py-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm w-full sm:w-auto">
                            <Avatar className="h-7 w-7 border-2 border-white dark:border-slate-950 shadow-sm shrink-0">
                                <AvatarFallback className="text-[10px] bg-slate-200 text-slate-700 font-bold dark:bg-slate-700 dark:text-slate-300">
                                    {assignedName[0]?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col min-w-0">
                                <span className="text-[9px] text-slate-400 font-bold uppercase leading-none mb-0.5 tracking-wider">
                                    Responsable
                                </span>

                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-none truncate max-w-[150px]">
                                    {assignedName}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 shrink-0">
                            <UserCheck size={14} className="text-slate-400" />{" "}
                            <span>Non assigné</span>
                        </div>
                    )}
                </div>

                {/* Grille de boutons d'actions adaptative */}

                <div className="grid grid-cols-2 sm:flex items-center justify-end gap-2">
                    {(ticket.assigned_to || isArchived) && (
                        <Button
                            onClick={onToggleChat}
                            size="sm"
                            variant="ghost"
                            className={`h-9 px-3 gap-2 w-full sm:w-auto text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ${isChatOpen ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" : ""}`}
                        >
                            {(isAssignedToMe || isCreatedByMe) && !isArchived ? (
                                <MessageSquare size={18} />
                            ) : (
                                <Eye size={18} />
                            )}

                            <span className="sm:hidden text-xs">Chat</span>
                        </Button>
                    )}

                    {isAssignedToMe && !isResolved && !isArchived && (
                        <Button
                            onClick={handleResolveTicket}
                            loading={isUpdating}
                            size="sm"
                            className={`${TICKET_THEME.button.success} h-9 px-4 gap-2 shadow-sm w-full sm:w-auto`}
                        >
                            {!isUpdating && <CheckCircle2 size={16} />}

                            <span className="text-xs">Résoudre</span>
                        </Button>
                    )}

                    {isAssignedToMe && isResolved && (
                        <>
                            <Button
                                onClick={handleReopenTicket}
                                loading={isUpdating}
                                size="sm"
                                variant="outline"
                                className={`${TICKET_THEME.button.outline} h-9 px-3 w-full sm:w-auto`}
                            >
                                {!isUpdating && <RotateCcw size={16} />}
                            </Button>

                            <Button
                                onClick={handleArchiveTicket}
                                loading={isUpdating}
                                size="sm"
                                className="h-9 px-4 gap-2 bg-foreground text-background hover:bg-foreground/90 shadow-sm w-full sm:w-auto"
                            >
                                {!isUpdating && <Box size={16} />}

                                <span className="text-xs">Archiver</span>
                            </Button>
                        </>
                    )}

                    {isClaimable && !isArchived && (
                        <Button
                            onClick={handleAssignToMe}
                            loading={isUpdating}
                            size="sm"
                            className={`${TICKET_THEME.button.primary} h-9 px-5 shadow-md hover:shadow-lg transition-shadow gap-2 col-span-2 sm:col-auto`}
                        >
                            {!isUpdating && <ArrowRightLeft size={16} />}
                            Prendre en charge
                        </Button>
                    )}

                    {isArchived && (
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1 px-2 cursor-default col-span-2 justify-center sm:justify-end">
                            <Archive size={14} /> Archivé
                        </span>
                    )}
                </div>
            </SheetFooter>
        </div>
    )
}
