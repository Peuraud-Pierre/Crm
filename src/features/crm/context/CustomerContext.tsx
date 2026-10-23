import {
    createContext,
    use,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    useCallback,
    useReducer,
} from "react"
import { toast } from "sonner"
import {
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import {
    CLIENTS_KEY,
    dedupeClients,
    fetchClientSearch,
    searchKey,
    tableKey,
    tableQueryOptions,
    useCachedClients,
    type ClientScope,
} from "@/features/crm/hooks/data/useClientsCache"
import type {
    Client,
    Tache as Tache_,
    ActiveTab,
    BoardData,
    ClientFilters,
    TaskStatus,
} from "@/features/crm/types"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
    buildClientTaskMap,
    filterClients,
    groupAndSortBoard,
} from "@/features/crm/utils/crmCompute"
import { getErrorMessage } from "@/features/crm/utils/errors"
import { SHARED_COLUMNS, UNASSIGNED_POOL_COLUMN } from "@/shared/utils/CrmTab"

// Colonnes de référence pour la visibilité « Mes Clients » : les leads non
// assignés ne sont partagés que dans le pool d'entrée (« Nouveau lead »), et
// seules les colonnes de SHARED_COLUMNS sont partagées par tous.

interface CustomersContextType {
    activeTab: ActiveTab
    setActiveTab: (tab: ActiveTab) => void
    viewMode: "board" | "table"
    setViewMode: (mode: "board" | "table") => void
    searchTerm: string
    setSearchTerm: (term: string) => void
    filters: ClientFilters
    updateFilter: (key: keyof ClientFilters, value: string) => void
    resetFilters: () => void | Promise<void>
    visibleColumns: Record<string, boolean>
    setVisibleColumns: (cols: Record<string, boolean>) => void
    hasActiveFilters: boolean

    // Data
    clientTaskMap: Map<string, TaskStatus>
    filteredClients: Client[]
    boardData: BoardData

    /** Commercial dont on affiche les leads (null = tous) : clé des listes en cache. */
    scope: ClientScope
    /** Vue tableau : pagination de la liste infinie. */
    hasMoreClients: boolean
    isLoadingMoreClients: boolean
    loadMoreClients: () => void

    // Actions
    refreshData: () => Promise<void>
    /** Rafraîchit UNIQUEMENT les compteurs DB par colonne — préserve la
     * pagination accumulée via loadMoreInColumn. À utiliser après un
     * update optimiste (drag-drop, edit) où le client est déjà à jour
     * en mémoire. */
    refreshCounts: () => Promise<void>
    handleNewLead: () => void
    handleClientClick: (client: Client) => void
    /** Incrémenté à chaque resetFilters — les colonnes l'observent pour remettre leur scroll à 0. */
    scrollResetToken: number
}

const CustomersContext = createContext<CustomersContextType | undefined>(
    undefined
)

const DEFAULT_FILTERS: ClientFilters = {
    user: "none",
    date: "all",
    experience: "all",
    task: "all",
}

export function CustomersProvider({ children }: { children: ReactNode }) {
    const {
        setUsersee,
        setClientToOpen,
        setCreationclient,
        fetch_research,
        fetchClientCounts,
        AllTache,
        setSelectedClient,
    } = useCRMContext()
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState<ActiveTab>("acquisition")
    const [viewMode, setViewMode] = useState<"board" | "table">("board")
    const [searchTerm, setSearchTerm] = useState("")
    const [filters, setFilters] = useState<ClientFilters>(DEFAULT_FILTERS)
    const [scrollResetToken, incrementScrollReset] = useReducer((n: number) => n + 1, 0)

    const [visibleColumns, setVisibleColumns] = useState<
        Record<string, boolean>
    >({
        client: true,
        etape: user?.service === "Accueil" ? false : true,
        budget: user?.service === "Accueil" ? false : true,
        activite: user?.service === "Accueil" ? true : false,
        contact: user?.service === "Accueil" ? true : false,
        maj: user?.service === "Accueil" ? false : true,
        timer: user?.service === "Accueil" ? false : true,
        setters: user?.service === "Accueil" ? true : false,
        closers: user?.service === "Accueil" ? true : false,
    })

    const currentUserId = useMemo(() => {
        if (filters.user === "none") return user?.user_id
        if (filters.user === "all") return undefined
        return filters.user
    }, [filters.user, user?.user_id])

    const scope: ClientScope = currentUserId ?? null

    // --- DONNÉES (cache TanStack, cf. useClientsCache) ---
    // Recherche serveur débouncée sur toute la table client_crm (et non les
    // seules cartes chargées), dans le périmètre courant.
    const [debouncedSearch, setDebouncedSearch] = useState("")
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
        return () => clearTimeout(t)
    }, [searchTerm])
    const isSearching = searchTerm.trim() !== "" && debouncedSearch !== ""
    const { data: searchResults } = useQuery({
        queryKey: searchKey(scope, debouncedSearch),
        queryFn: () => fetchClientSearch(scope, debouncedSearch),
        enabled: debouncedSearch !== "",
        placeholderData: keepPreviousData,
    })

    // Vue tableau : liste infinie du périmètre.
    const table = useInfiniteQuery({
        ...tableQueryOptions(scope),
        enabled: viewMode === "table" && !isSearching,
    })

    // Vue Kanban : chaque KanbanColumn charge sa liste infinie ; on lit ici
    // l'union de ces colonnes pour le périmètre courant.
    const columnsPrefix = useMemo(
        () => [...CLIENTS_KEY, "column", scope],
        [scope]
    )
    const columnClients = useCachedClients(columnsPrefix)

    const clients = useMemo(() => {
        if (isSearching) return searchResults ?? []
        if (viewMode === "table")
            return dedupeClients(table.data?.pages.flat() ?? [])
        return columnClients
    }, [isSearching, searchResults, viewMode, table.data, columnClients])

    const refreshData = useCallback(async () => {
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: columnsPrefix }),
                queryClient.invalidateQueries({ queryKey: tableKey(scope) }),
                fetchClientCounts(currentUserId),
            ])
        } catch (error: unknown) {
            const msg = getErrorMessage(error)
            console.error("Erreur refresh :", msg)
            toast.error(`Erreur de chargement des clients: ${msg}`)
        }
    }, [queryClient, columnsPrefix, scope, fetchClientCounts, currentUserId])

    const refreshCounts = useCallback(async () => {
        try {
            await fetchClientCounts(currentUserId)
        } catch (error: unknown) {
            console.error(
                "Erreur refresh counts :",
                getErrorMessage(error)
            )
        }
    }, [fetchClientCounts, currentUserId])

    // Au montage : commerciaux + compteurs. Les listes se chargent seules
    // (requêtes TanStack), depuis le cache si on revient sur l'onglet.
    useEffect(() => {
        if (!user?.user_id) return
        const load = async () => {
            try {
                await fetch_research()
            } catch (error: unknown) {
                console.error("Erreur load initial :", getErrorMessage(error))
            }
        }
        void load()
    }, [user?.user_id, fetch_research])
    useEffect(() => {
        if (user?.user_id) void refreshCounts()
    }, [user?.user_id, refreshCounts])

    // Changement de filtre commercial : le périmètre (donc les clés de cache)
    // change et les listes suivent d'elles-mêmes ; on remet le scroll à 0.
    const prevUserFilterRef = useRef(filters.user)
    useEffect(() => {
        if (prevUserFilterRef.current === filters.user) return
        prevUserFilterRef.current = filters.user
        incrementScrollReset()
    }, [filters.user])

    const updateFilter = useCallback(
        (key: keyof ClientFilters, value: string) => {
            setFilters((prev) => ({ ...prev, [key]: value }))
        },
        []
    )

    const resetFilters = useCallback(() => {
        setSearchTerm("")
        setFilters(DEFAULT_FILTERS)
        incrementScrollReset()
    }, [])

    const handleNewLead = useCallback(() => {
        setSelectedClient?.(null)
        setUsersee?.(null)
        setCreationclient?.(true)
    }, [setSelectedClient, setUsersee, setCreationclient])

    const handleClientClick = useCallback(
        (client: Client) => {
            setClientToOpen?.(client as Tache_["client"])
        },
        [setClientToOpen]
    )

    const hasActiveFilters =
        (filters.user !== "none" && filters.user !== "all") ||
        filters.date !== "all" ||
        filters.experience !== "all" ||
        filters.task !== "all" ||
        searchTerm !== ""

    // Pastilles de statut = tâches de TOUT LE MONDE (version légère) sur chaque
    // client → visibles par superviseur / setters / closers.
    const clientTaskMap = useMemo(
        () => buildClientTaskMap(clients, AllTache),
        [clients, AllTache]
    )

    const visibleColsIndices = useMemo(() => {
        // Index 9 = "RDV à confirmer" (RDV Amelia en attente), colonne
        // acquisition uniquement. Sans lui ici, filterClients jetterait ces
        // clients avant le groupement et la colonne resterait vide.
        if (user?.service === "Accueil") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        return activeTab === "acquisition"
            ? [0, 1, 2, 3, 4, 7, 8, 9]
            : [3, 4, 5, 6, 7, 8]
    }, [user?.service, activeTab])

    // Quand une recherche est active, on affiche tous les clients correspondants
    // sans restriction de colonne — la recherche serveur a déjà pré-filtré par terme.
    const ALL_COLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const filteredClients = useMemo(() => {
        let base = filterClients(clients, {
            searchTerm,
            filters,
            clientTaskMap,
            visibleColsIndices: searchTerm ? ALL_COLS : visibleColsIndices,
        })
        // Filtre user côté client : quand un commercial spécifique est sélectionné,
        // on restreint aux clients chargés dont il est customer ou closer.
        // "all" = tout afficher.
        if (filters.user !== "none" && filters.user !== "all") {
            const uid = filters.user
            base = base.filter(
                (c) =>
                    (c.customer as { user_id?: string } | null)?.user_id === uid ||
                    (c.closers as { user_id?: string } | null)?.user_id === uid
            )
        } else if (filters.user === "none") {
            // "Mes Clients" : gate autoritaire — mes leads (customer/closer) +
            // non-assignés UNIQUEMENT en colonne "Nouveau lead" + colonnes
            // partagées (SHARED_COLUMNS). Garantit qu'un lead sorti du pool d'entrée par un autre
            // utilisateur disparaît du board, même si le realtime l'a mis à jour
            // en mémoire.
            const uid = user?.user_id
            base = base.filter((c) => {
                const isMine =
                    (c.customer as { user_id?: string } | null)?.user_id === uid ||
                    (c.closers as { user_id?: string } | null)?.user_id === uid
                const col = c.collum ?? 0
                const isSharedNewLead =
                    c.customer == null && col === UNASSIGNED_POOL_COLUMN
                return isMine || isSharedNewLead || SHARED_COLUMNS.includes(col)
            })
        }
        return base
    }, [clients, searchTerm, filters, clientTaskMap, visibleColsIndices, user?.user_id])

    // Préserve la référence array de chaque colonne tant que son contenu (par
    // identité d'objet client) n'a pas bougé. Sans ça, un loadMore qui n'injecte
    // de nouveaux clients QUE dans une colonne ferait re-render toutes les
    // autres colonnes (boardData.groups[*] changent toutes de ref).
    const prevBoardDataRef = useRef<BoardData | null>(null)
    const boardData = useMemo(() => {
        const next = groupAndSortBoard(filteredClients, activeTab)
        const prev = prevBoardDataRef.current
        if (prev) {
            for (const col of next.visibleCols) {
                const a = next.groups[col]
                const b = prev.groups[col]
                if (
                    b &&
                    a.length === b.length &&
                    a.every((c, i) => c === b[i])
                ) {
                    next.groups[col] = b
                }
            }
        }
        prevBoardDataRef.current = next
        return next
    }, [filteredClients, activeTab])

    const value = useMemo<CustomersContextType>(
        () => ({
            activeTab,
            setActiveTab,
            viewMode,
            setViewMode,
            searchTerm,
            setSearchTerm,
            filters,
            updateFilter,
            resetFilters,
            visibleColumns,
            setVisibleColumns,
            hasActiveFilters,
            clientTaskMap,
            filteredClients,
            boardData,
            scope,
            hasMoreClients: !!table.hasNextPage,
            isLoadingMoreClients: table.isFetchingNextPage,
            loadMoreClients: () => {
                if (table.hasNextPage && !table.isFetchingNextPage)
                    void table.fetchNextPage()
            },
            refreshData,
            refreshCounts,
            handleNewLead,
            handleClientClick,
            scrollResetToken,
        }),
        [
            activeTab,
            viewMode,
            searchTerm,
            filters,
            updateFilter,
            resetFilters,
            visibleColumns,
            hasActiveFilters,
            clientTaskMap,
            filteredClients,
            boardData,
            scope,
            table,
            refreshData,
            refreshCounts,
            handleNewLead,
            handleClientClick,
            scrollResetToken,
        ]
    )

    return (
        <CustomersContext value={value}>
            {children}
        </CustomersContext>
    )
}

export const useCustomers = () => {
    const context = use(CustomersContext)
    if (!context)
        throw new Error("useCustomers must be used within a CustomersProvider")
    return context
}
