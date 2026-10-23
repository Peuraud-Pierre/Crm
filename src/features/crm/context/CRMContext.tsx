import type {
    CalendarView,
    activites,
    Event_creation,
    EventDateRange,
    Client,
    FicheAppro,
    Search,
    Devis,
    Product,
    Tache,
} from "@/features/crm/types"
import { useActivites } from "../hooks/CRM_hook/use_activites"
import { useEvent, type SlotConflict } from "../hooks/CRM_hook/use_calendar"
import { useClient } from "../hooks/CRM_hook/use_client"
import {
    type fetchDevisType,
    useDevis,
} from "../hooks/CRM_hook/use_devis"
import { useProduct } from "../hooks/CRM_hook/use_product"
import { useTache } from "../hooks/CRM_hook/use_tache"
import {
    areIntervalsOverlapping,
    endOfDay,
    isSameDay,
    startOfDay,
} from "date-fns"
import { toZonedTime } from "date-fns-tz"
import {
    createContext,
    createElement,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useCallback,
    use,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

interface CRMContextType {
    activeTab: string
    setActiveTab: (tab: string) => void

    FicheClient: boolean
    setFicheclient: Dispatch<SetStateAction<boolean>>

    selectedClient: Client | null
    setSelectedClient: (client: Client | null) => void

    creationclient: boolean
    setCreationclient: (state: boolean) => void

    usersee: Client | null
    setUsersee: (client: Client | null) => void

    edit: boolean
    setEdit: Dispatch<SetStateAction<boolean>>

    fiche: FicheAppro
    setFiche: Dispatch<SetStateAction<FicheAppro>>

    event: activites | null
    setEvent: Dispatch<SetStateAction<activites | null>>

    customer: Client | undefined
    setCustomer: Dispatch<SetStateAction<Client | undefined>>

    Update: boolean
    setUpdate: Dispatch<SetStateAction<boolean>>

    creationEvent: boolean
    setCreationevent: Dispatch<SetStateAction<boolean>>

    creation: boolean
    setCreation: Dispatch<SetStateAction<boolean>>

    date: Date
    setDate: Dispatch<SetStateAction<Date>>

    calendarView: CalendarView
    setCalendarView: Dispatch<SetStateAction<CalendarView>>

    eventToEdit: Event_creation | null
    setEventToEdit: Dispatch<SetStateAction<Event_creation | null>>

    // ✅ NOUVEAU : État pour le résumé du rendez-vous (Popup)
    selectedEventInfo: Event_creation | null
    setSelectedEventInfo: Dispatch<SetStateAction<Event_creation | null>>

    // ✅ NOUVELLE FONCTION : Orchestrateur d'ouverture de RDV
    handleOpenEventSummary: (event: Event_creation) => void

    Info: Devis | null
    setInfo: Dispatch<SetStateAction<Devis | null>>

    creationDevis: boolean
    setCreationDevis: Dispatch<SetStateAction<boolean>>

    searchTerm: string
    setSearchTerm: Dispatch<SetStateAction<string>>

    statusFilter: string
    setStatusFilter: Dispatch<SetStateAction<string>>

    clientFilter: string
    setClientFilter: Dispatch<SetStateAction<string>>

    sortBy: string
    setSortBy: Dispatch<SetStateAction<string>>

    combinedFilter: string
    setCombinedFilter: Dispatch<SetStateAction<string>>

    combinedRef: React.MutableRefObject<string>

    allUsers: {
        id: string
        full_name: string
    }[]
    setAllUsers: Dispatch<
        SetStateAction<
            {
                id: string
                full_name: string
            }[]
        >
    >
    clientToOpen: Tache["client"] | null
    setClientToOpen: Dispatch<SetStateAction<Tache["client"] | null>>
    openClientFiche: (client: Client) => void

    // ============================== Calendar ==============================
    timeZone: string
    HOUR_HEIGHT: number
    DAY_HEIGHT: number

    scrollToEvent: (evtId: string) => void
    saveAllEvents: () => void

    // ============================== Event ==============================
    events: Event_creation[]
    fetch_calendar_event: (
        ownerId?: string,
        range?: EventDateRange
    ) => Promise<void>
    create_event_calendar: (event: Event_creation) => Promise<void>
    update_Event: (event: Event_creation) => Promise<void>
    /** Confirme un RDV Amelia en attente : n'écrit que `confirmed`. */
    confirm_event: (event: Event_creation) => Promise<void>
    deleteEvent: (id_event: string) => Promise<void>

    // ============================== Activite ==============================
    activites: activites[]
    create_activites: (activite: activites) => Promise<void>
    fetch_activite: (clientId?: string) => Promise<void>
    update_Activites: (act: activites) => Promise<void>
    delete_activites: (
        id: string | undefined,
        client: string | undefined
    ) => Promise<void>

    // ============================== Client ==============================
    clients: Client[]
    search: Search[]
    profiles: Search[]
    fetch_research: () => Promise<Search[] | undefined>
    create_fiche_client: (client: Client) => Promise<Client | null>
    /** Charge la version COMPLÈTE d'un client (toutes colonnes) — utilisé à l'ouverture de la fiche. */
    fetchOneClient: (clientId: string) => Promise<Client | null>
    /** Récupère les compteurs DB par colonne Kanban (indépendant de la pagination). */
    fetchClientCounts: (userId?: string) => Promise<Record<number, number>>
    /** Compteurs DB par colonne — clé = index `collum` (0..8). */
    clientCountsByColumn: Record<number, number>
    update_fiche_client: (
        changes: Partial<Client> & {
            id: string
            customer?: string | null
            closers?: string | null
        }
    ) => Promise<void>
    delete_fiche_client: (id: string) => Promise<void>
    take_lead: (id: string) => Promise<void>

    // ============================== Devis ==============================
    Devis: Devis[]
    isDevisLoading: boolean
    devisError: string | null
    fetchDevisByUser: fetchDevisType["fetchDevisByUser"]
    Register_devis: fetchDevisType["Register_devis"]
    Update_devis: fetchDevisType["Update_devis"]
    DeleteDevis: fetchDevisType["DeleteDevis"]

    // ============================== Produit ==============================
    Produit: Product[]
    create_product: (product: Product) => Promise<void>
    fetch_products: () => Promise<Product[] | undefined>
    delete_product: (id: number) => Promise<void>
    update_product: (id: number, updates: Partial<Product>) => Promise<void>
    refreshProducts: () => Promise<void>
    /** Active le chargement des produits + devis (onglet Devis / création). */
    enableProducts: () => void

    // ============================== Tache ==============================
    /** MES tâches (owner = utilisateur courant). */
    Tache: Tache[]
    /** Tâches que j'ai créées et assignées à quelqu'un d'autre. */
    TacheDelegated: Tache[]
    /** Toutes les tâches en version légère (id, client, date) — pastilles du board. */
    AllTache: Tache[]
    /** Tâches complètes du client ouvert dans la fiche. */
    clientTaches: Tache[]
    create_Tache: (Tache: Tache) => Promise<void>
    fetch_Tache: () => Promise<Tache[] | undefined>
    update_Tache: (id: string, updates: Partial<Tache>) => Promise<void>
    delete_Tache: (id: string) => Promise<void>
    /** Charge les tâches complètes d'un client (fiche). */
    fetch_client_taches: (clientId: string) => Promise<void>

    eventsForCurrentDay: Event_creation[]
    getDayEvents: (day: Date, allEvents: Event_creation[]) => Event_creation[]
    eventIntersectsDay: (evt: Event_creation, day: Date) => boolean
    defaultGetDayEvents: (
        day: Date,
        allEvents: Event_creation[]
    ) => Event_creation[]

    setIsSidebarOpen: Dispatch<SetStateAction<boolean>>
    isSidebarOpen: boolean
    isSlotBusy: (
        targetId: string,
        newStart: string,
        newEnd: string,
        excludeId?: string
    ) => Promise<boolean>
    /** Comme isSlotBusy, mais renvoie l'événement en conflit (ou null). */
    findSlotConflict: (
        targetId: string,
        newStart: string,
        newEnd: string,
        excludeId?: string
    ) => Promise<SlotConflict | null>

    fetch_Tache_alltask: () => Promise<void>
    openEventModal: string | number | null
    _setOpenEventModal: Dispatch<SetStateAction<string | number | null>>
    saveTimeout: React.MutableRefObject<NodeJS.Timeout | null>
    setOpenEventModal: (clientId: string | number | null) => void
}

const CRMContext = createContext<CRMContextType | undefined>(undefined)

export function CRMProvider({ children }: { children: ReactNode }) {
    const [activeTab, setActiveTab] = useState<string>(
        () => localStorage.getItem("activeTab") || "calendar"
    )

    const timeZone = "UTC"
    const HOUR_HEIGHT = 64
    const DAY_HEIGHT = 64 * 24

    const [creationDevis, setCreationDevis] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [clientFilter, setClientFilter] = useState<string>("all")
    const [sortBy, setSortBy] = useState<string>("date")
    const [combinedFilter, setCombinedFilter] = useState<string>(
        localStorage.getItem("combinedFilter") || "all"
    )
    const combinedRef = useRef(combinedFilter)
    // Synchronise la ref à chaque changement de state pour éviter les stale closures
    useEffect(() => {
        combinedRef.current = combinedFilter
    }, [combinedFilter])

    const [allUsers, setAllUsers] = useState<
        { id: string; full_name: string }[]
    >([])
    const [Info, setInfo] = useState<Devis | null>(null)
    const [calendarView, setCalendarView] = useState<CalendarView>("month")
    const [date, setDate] = useState<Date>(() => toZonedTime(new Date(), "UTC"))
    const [creation, setCreation] = useState(false)
    const [creationEvent, setCreationEvent] = useState(false)
    const setCreationevent = setCreationEvent
    const [edit, setEdit] = useState(false)
    const [Update, setUpdate] = useState(false)
    const [FicheClient, setFicheClient] = useState<boolean>(false)
    const setFicheclient = setFicheClient
    const [creationclient, setCreationclient] = useState(false)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [usersee, setUsersee] = useState<Client | null>(null)
    const [event, setEvent] = useState<activites | null>(null)
    const [customer, setCustomer] = useState<Client>()
    const [eventToEdit, setEventToEdit] = useState<Event_creation | null>(null)

    const [selectedEventInfo, setSelectedEventInfo] =
        useState<Event_creation | null>(null)

    const [fiche, setFiche] = useState<FicheAppro>({
        vendDeja: [],
        recherche: [],
        boutiqueType: undefined,
        surface: undefined,
        plateformes: [],
        localisationType: undefined,
        vintage: false,
        vintageDepuis: "",
        budget: 0,
        approvisionnement: "",
        type: "",
        besoinsHomme: [],
        besoinsFemme: [],
        Note: "",
        evaluationRange: [],
        marques: [],
    })

    const scrollToEvent = useCallback((evtId: string) => {
        const eventEl = document.getElementById(`${evtId}-resume`)
        if (eventEl) {
            eventEl.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }, [])

    const [clientToOpen, setClientToOpen] = useState<Tache["client"] | null>(
        null
    )

    const {
        events,
        create_event_calendar,
        fetch_calendar_event,
        deleteEvent,
        update_Event,
        confirm_event,
        isSlotBusy,
        findSlotConflict,
    } = useEvent()
    // Le flux produits (toute la table `product` + 3 channels realtime) n'est
    // chargé qu'à la demande (onglet Bon de commande / création de devis), pas
    // sur l'onglet Clients. enableProducts() l'active.
    const [productsEnabled, setProductsEnabled] = useState(false)
    const enableProducts = useCallback(() => setProductsEnabled(true), [])
    const {
        Produit,
        create_product,
        fetch_products,
        delete_product,
        update_product,
        refreshProducts,
    } = useProduct(productsEnabled)
    const {
        activites,
        create_activites,
        fetch_activite,
        update_Activites,
        delete_activites,
    } = useActivites()
    const {
        clients,
        search,
        fetch_research,
        create_fiche_client,
        fetchOneClient,
        fetchClientCounts,
        clientCountsByColumn,
        update_fiche_client,
        delete_fiche_client,
        take_lead,
    } = useClient()

    // Sync automatique du customer ouvert quand clients[] est mis à jour (édition
    // de fiche, realtime, drag pipeline…). On resynchronise sur tout changement
    // réel via updated_at (mis à jour à chaque écriture), avec collum en repli.
    useEffect(() => {
        if (!customer?.id) return
        const updated = clients.find((c) => c.id === customer.id)
        if (
            updated &&
            (updated.updated_at !== customer.updated_at ||
                updated.collum !== customer.collum)
        ) {
            // Fusion (et non remplacement) : la version de clients[] peut être
            // « légère » (CLIENT_LIST_SELECT, sans message/depense/adresse_*…).
            // Spread → on applique les champs légers modifiés (collum, updated_at,
            // brief, relations) tout en conservant les champs lourds hydratés via
            // fetchOneClient. Si clients[id] a été hydraté complet par le realtime,
            // ses champs lourds (message inclus) sont appliqués normalement.
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resynchro de l'entité ouverte depuis clients[]
            setCustomer((prev) => (prev ? { ...prev, ...updated } : updated))
        }
    }, [clients, customer])

    const {
        Tache,
        TacheDelegated,
        AllTache,
        clientTaches,
        create_Tache,
        fetch_Tache,
        update_Tache,
        delete_Tache,
        fetch_Tache_alltask,
        fetch_client_taches,
    } = useTache()
    const {
        Devis,
        isLoading: isDevisLoading,
        error: devisError,
        Register_devis,
        fetchDevisByUser,
        Update_devis,
        DeleteDevis,
    } = useDevis(productsEnabled)

    // ✅ NOUVEAU : Fonction orchestratrice d'ouverture du résumé
    const handleOpenEventSummary = useCallback((event: Event_creation) => {
        // 1. Définit l'événement pour la popup résumé
        setSelectedEventInfo(event)
        // 2. Change la date du calendrier pour aller au jour du RDV
        if (event.debut) {
            setDate(new Date(event.debut))
        }
        // 3. Bascule sur l'onglet calendrier
        setActiveTab("calendar")
        // 4. Désactive les modes d'édition/création pour ne pas superposer
        setUpdate(false)
        setCreationevent(false)
        // 5. Ferme la fiche client pour voir le calendrier
        setFicheclient(false)
    }, [])

    const defaultGetDayEvents = useCallback(
        (day: Date, events: Event_creation[]) =>
            events.filter((evt) =>
                isSameDay(toZonedTime(evt.debut, timeZone), day)
            ),
        [timeZone]
    )

    const eventIntersectsDay = useCallback(
        (evt: Event_creation, day: Date) => {
            if (!evt.debut || !evt.fin) return false
            const start = toZonedTime(evt.debut, timeZone)
            const end = toZonedTime(evt.fin, timeZone)
            const dayStart = startOfDay(day)
            const dayEnd = endOfDay(day)
            return areIntervalsOverlapping(
                { start, end },
                { start: dayStart, end: dayEnd },
                { inclusive: true }
            )
        },
        [timeZone]
    )

    const getDayEvents = useCallback(
        (day: Date, allEvents: Event_creation[]) => {
            if (!allEvents) return []
            const filteredEvents = allEvents.filter((e) =>
                eventIntersectsDay(e, day)
            )
            const uniqueMap = new Map()
            filteredEvents.forEach((e) => {
                if (e.id) uniqueMap.set(e.id, e)
            })
            return Array.from(uniqueMap.values())
        },
        [eventIntersectsDay]
    )

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const saveTimeout = saveTimeoutRef
    const [openEventModalId, setOpenEventModalId] = useState<
        string | number | null
    >(null)
    const openEventModal = openEventModalId

    // NB : pas de « flush » du brief ici. Le debounce de saveFiche (fiche.tsx)
    // porte déjà le bon client.id et la bonne fiche dans sa closure et tirera
    // de lui-même ; réécrire ici le couple customer/fiche COURANT du contexte
    // pouvait croiser les clients (fiche de A écrite sur B pendant la fenêtre
    // d'hydratation) ou écraser des données DB plus fraîches avec la copie
    // mémoire, et perdait la dernière frappe en annulant le timeout.
    const setOpenEventModal = useCallback(
        (clientId: string | number | null) => {
            setOpenEventModalId(clientId)
        },
        []
    )

    const eventsForCurrentDay = useMemo(() => {
        return getDayEvents(date, events)
    }, [date, events, getDayEvents])

    const saveAllEvents = useCallback(() => {
        events.forEach((evt) => update_Event(evt))
    }, [events, update_Event])

    const openClientFiche = useCallback((client: Client) => {
        setCustomer(client)
        setFicheclient(true)
    }, [])

    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    const value = useMemo(
        () => ({
            selectedEventInfo,
            setSelectedEventInfo,
            handleOpenEventSummary, // ✅ Ajouté ici
            eventsForCurrentDay,
            defaultGetDayEvents,
            eventIntersectsDay,
            getDayEvents,
            FicheClient,
            setFicheclient,
            activeTab,
            setActiveTab,
            selectedClient,
            setSelectedClient,
            creationclient,
            setCreationclient,
            usersee,
            setUsersee,
            Tache,
            create_Tache,
            events,
            fetch_calendar_event,
            create_event_calendar,
            update_Event,
            confirm_event,
            deleteEvent,
            activites,
            create_activites,
            fetch_activite,
            update_Activites,
            delete_activites,
            clients,
            search,
            profiles: search,
            fetch_research,
            fetch_Tache,
            create_fiche_client,
            fetchOneClient,
            fetchClientCounts,
            clientCountsByColumn,
            update_fiche_client,
            delete_fiche_client,
            Devis,
            isDevisLoading,
            devisError,
            Register_devis,
            fetchDevisByUser,
            Update_devis,
            DeleteDevis,
            fiche,
            setFiche,
            event,
            setEvent,
            edit,
            setEdit,
            customer,
            setCustomer,
            timeZone,
            HOUR_HEIGHT,
            DAY_HEIGHT,
            scrollToEvent,
            saveAllEvents,
            Update,
            setUpdate,
            creationEvent,
            setCreationevent,
            creation,
            setCreation,
            date,
            setDate,
            calendarView,
            setCalendarView,
            eventToEdit,
            setEventToEdit,
            Info,
            setInfo,
            creationDevis,
            setCreationDevis,
            searchTerm,
            setSearchTerm,
            statusFilter,
            setStatusFilter,
            clientFilter,
            setClientFilter,
            sortBy,
            setSortBy,
            combinedFilter,
            setCombinedFilter,
            combinedRef,
            allUsers,
            setAllUsers,
            Produit,
            create_product,
            fetch_products,
            delete_product,
            update_product,
            refreshProducts,
            enableProducts,
            clientToOpen,
            setClientToOpen,
            openClientFiche,
            update_Tache,
            delete_Tache,
            AllTache,
            TacheDelegated,
            clientTaches,
            fetch_client_taches,
            take_lead,
            isSlotBusy,
            findSlotConflict,
            isSidebarOpen,
            setIsSidebarOpen,
            fetch_Tache_alltask,
            setOpenEventModal,
            openEventModal,
            _setOpenEventModal: setOpenEventModalId,
            saveTimeout,
        }),
        [
            selectedEventInfo,
            setSelectedEventInfo,
            handleOpenEventSummary, // ✅ Ajouté ici
            eventsForCurrentDay,
            defaultGetDayEvents,
            eventIntersectsDay,
            getDayEvents,
            FicheClient,
            setFicheclient,
            activeTab,
            setActiveTab,
            selectedClient,
            setSelectedClient,
            creationclient,
            setCreationclient,
            usersee,
            setUsersee,
            Tache,
            create_Tache,
            events,
            fetch_calendar_event,
            create_event_calendar,
            update_Event,
            confirm_event,
            deleteEvent,
            activites,
            create_activites,
            fetch_activite,
            update_Activites,
            delete_activites,
            clients,
            search,
            fetch_research,
            fetch_Tache,
            create_fiche_client,
            fetchOneClient,
            fetchClientCounts,
            clientCountsByColumn,
            update_fiche_client,
            delete_fiche_client,
            Devis,
            isDevisLoading,
            devisError,
            Register_devis,
            fetchDevisByUser,
            Update_devis,
            DeleteDevis,
            fiche,
            setFiche,
            event,
            setEvent,
            edit,
            setEdit,
            customer,
            setCustomer,
            Update,
            setUpdate,
            creationEvent,
            setCreationevent,
            creation,
            setCreation,
            date,
            setDate,
            calendarView,
            setCalendarView,
            eventToEdit,
            setEventToEdit,
            Info,
            setInfo,
            creationDevis,
            setCreationDevis,
            searchTerm,
            setSearchTerm,
            statusFilter,
            setStatusFilter,
            clientFilter,
            setClientFilter,
            sortBy,
            setSortBy,
            combinedFilter,
            setCombinedFilter,
            allUsers,
            Produit,
            enableProducts,
            TacheDelegated,
            clientTaches,
            fetch_client_taches,
            clientToOpen,
            isSidebarOpen,
            isSlotBusy,
            setOpenEventModal,
            openEventModal,
            setOpenEventModalId,
            saveTimeout,
        ]
    )
    return createElement(CRMContext, { value }, children)
}

export function useCRMContext() {
    const context = use(CRMContext)
    if (!context)
        throw new Error("useCRMContext must be used inside a CRMProvider")
    return context
}
