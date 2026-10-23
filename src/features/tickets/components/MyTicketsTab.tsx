import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Plus, Ticket as TicketIcon, ChevronDown } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { Input } from "@/shared/ui/atoms/input"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { Button } from "@/shared/ui/atoms/button"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { ScrollArea } from "@/shared/ui/atoms/scroll-area"
import { useTicketContext } from "../context/TicketContext"
import { TICKET_THEME } from "../ticket.theme"
import { TicketDetailSheet } from "./TicketKanban/TicketDetailSheet"
import type { Ticket } from "./types"
import { MyTicketCard } from "./Ticket/MyTicketCard"
import { TicketCreationSheet } from "./TicketCreation/TicketForm"

// --- Custom Hook useThrottle (On le garde car c'est utile pour la perf) ---
function useThrottle<T>(value: T, interval: number = 500): T {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const lastExecutedRef = useRef<number>(Date.now());

    useEffect(() => {
        const now = Date.now();
        const timeRemaining = interval - (now - lastExecutedRef.current);
        // On passe toujours par un timer (delay 0 si l'intervalle est écoulé)
        // pour éviter un setState synchrone dans l'effet.
        const timerId = setTimeout(
            () => {
                setThrottledValue(value);
                lastExecutedRef.current = Date.now();
            },
            timeRemaining <= 0 ? 0 : timeRemaining
        );
        return () => clearTimeout(timerId);
    }, [value, interval]);

    return throttledValue;
}

export default function MyTicketsPage() {
    const { tickets, isLoading } = useTicketContext()
    const { user } = useAuth()
    
    // --- STATE UI LIMIT ---
    const ITEMS_PER_PAGE = 5; // Nombre de tickets affichés au départ
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    const throttledTickets = useThrottle(tickets, 500);

    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"active" | "closed">("active")
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    // Reset contrôlé de la pagination lors d'un changement de filtre/recherche.
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setVisibleCount(ITEMS_PER_PAGE);
    }, [statusFilter, search]);

    // --- FILTRAGE ---
    const myTickets = useMemo(() => {
        if (!user || !throttledTickets) return []

        const lowerSearch = search.toLowerCase().trim()

        return throttledTickets
            .filter((t) => {
                const isMyTicket = t.created_by === user.user_id
                if (!isMyTicket) return false

                const matchesSearch =
                    lowerSearch === "" ||
                    t.title.toLowerCase().includes(lowerSearch) ||
                    (t.id && t.id.toString().includes(lowerSearch))

                const matchesStatus =
                    statusFilter === "active"
                        ? t.status !== "clos" && t.status !== "résolu"
                        : t.status === "clos" || t.status === "résolu"

                return matchesSearch && matchesStatus
            })
            .sort(
                (a, b) =>
                    new Date(b.created_at || 0).getTime() -
                    new Date(a.created_at || 0).getTime()
            )
    }, [throttledTickets, user, search, statusFilter])

    // --- SLICING (Découpage pour l'affichage) ---
    const displayedTickets = myTickets.slice(0, visibleCount);
    const hasMore = visibleCount < myTickets.length;

    const handleOpenTicket = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setIsSheetOpen(true)
    }

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    }

    return (
        <div className={`flex flex-col h-full w-full `}>
            {/* HEADER */}
            <div className="px-6 py-8 md:py-10 max-w-5xl mx-auto w-full space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl md:text-3xl font-black tracking-tight mb-2 ${TICKET_THEME.page.text}`}>
                            Mes Demandes
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                            Suivez l'avancement de vos tickets et échangez avec le support.
                        </p>
                    </div>

                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className={`${TICKET_THEME.button.primary} shadow-lg shadow-emerald-500/20 px-6`}
                    >
                        <Plus size={18} className="mr-2" />
                        Nouveau Ticket
                    </Button>
                </div>

                {/* BARRE D'OUTILS */}
                <div className={`flex flex-col md:flex-row gap-4 md:items-center justify-between p-1.5 rounded-2xl border ${TICKET_THEME.bar.container} shadow-sm`}>
                    <Tabs
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v as "active" | "closed")}
                        className="w-full md:w-auto"
                    >
                        <TabsList indicator className="bg-muted p-1 h-10 w-full md:w-auto grid grid-cols-2 md:flex gap-1 rounded-xl">
                            <TabsTrigger
                                value="active"
                                className="text-xs font-bold px-4 rounded-lg"
                            >
                                En cours
                            </TabsTrigger>
                            <TabsTrigger
                                value="closed"
                                className="text-xs font-bold px-4 rounded-lg"
                            >
                                Terminés / Clos
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative flex-1 md:max-w-xs pr-1.5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            placeholder="Rechercher par titre ou ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`pl-9 h-9 border-0 bg-slate-50 dark:bg-slate-950 focus-visible:ring-0 focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 transition-colors ${TICKET_THEME.input.text}`}
                        />
                    </div>
                </div>
            </div>

            {/* LISTE DES TICKETS */}
            <ScrollArea className="flex-1 px-6 pb-6">
                <div className="max-w-5xl mx-auto w-full space-y-3">
                    {isLoading ? (
                        <SkeletonList rows={5} avatar label="Chargement des tickets…" />
                    ) : myTickets.length === 0 ? (
                        <EmptyState
                            className={`border-2 border-dashed ${TICKET_THEME.kanban.column.border} rounded-2xl`}
                            variant={search ? "search" : "default"}
                            icon={TicketIcon}
                            title="Aucun ticket trouvé"
                            description={
                                search
                                    ? "Essayez de modifier vos termes de recherche."
                                    : "Vous n'avez aucune demande correspondant à ce filtre."
                            }
                        />
                    ) : (
                        <>
                            {/* Liste découpée */}
                            {displayedTickets.map((ticket) => (
                                <MyTicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    onClick={() => handleOpenTicket(ticket)}
                                />
                            ))}

                            {/* Bouton Voir Plus */}
                            {hasMore && (
                                <div className="pt-4 flex justify-center pb-8">
                                    <Button 
                                        variant="outline" 
                                        onClick={handleLoadMore}
                                        className="gap-2 bg-card dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full px-6"
                                    >
                                        <ChevronDown size={16} />
                                        Afficher plus de tickets ({myTickets.length - visibleCount} restants)
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>

            {/* SHEETS */}
            {selectedTicket && (
                <TicketDetailSheet
                    ticket={selectedTicket}
                    open={isSheetOpen}
                    onClose={() => setIsSheetOpen(false)}
                />
            )}

            <TicketCreationSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
            />
        </div>
    )
}