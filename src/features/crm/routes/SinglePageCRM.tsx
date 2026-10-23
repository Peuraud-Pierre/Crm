import CustomersTab from "@/features/crm/CustomersTab"
import CustomerDetailDialog from "@/features/crm/components/Client/fiche"
// Onglets lourds chargés à la demande (recharts, jspdf, etc. hors bundle Clients)
const CalendarTab = lazy(() => import("@/features/crm/CalendarTab"))
const QuotesTab = lazy(() => import("@/features/crm/QuotesTab"))
const PageWithTable = lazy(() => import("@/features/crm/Tachetab"))
const TourneeTab = lazy(() => import("@/features/tournee/routes/TourneeTab"))

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/shared/ui/atoms/tabs"
import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"

import {
    Calendar as CalendarIcon,
    Dices,
    FileCheck,
    Users,
    CheckSquare,
} from "lucide-react"

import {
    lazy,
    Suspense,
    useEffect,
    useMemo,
    useRef,
    type ComponentType,
} from "react"
import {
    useSearchParams,
    useParams,
    useNavigate,
    useLocation,
} from "react-router"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth"
import type { CalendarView, Client } from "@/features/crm/types"
import { CrmErrorBoundary } from "@/features/crm/components/_shared/CrmErrorBoundary"

interface CrmTab {
    id: string
    label: string
    icon: typeof CalendarIcon
    component: ComponentType
    /** Code de permission requis pour voir l'onglet (aucun = visible par tous). */
    permission?: string
}

const tabs: CrmTab[] = [
    {
        id: "calendar",
        label: "Calendrier",
        icon: CalendarIcon,
        component: CalendarTab,
    },
    {
        id: "customers",
        label: "Clients",
        icon: Users,
        component: CustomersTab,
    },
    {
        id: "Tache",
        label: "Tache",
        icon: CheckSquare,
        component: PageWithTable,
    },
    {
        id: "quotes",
        label: "Bon de commande",
        icon: FileCheck,
        component: QuotesTab,
    },
    {
        id: "tournee",
        label: "La Tournée",
        icon: Dices,
        component: TourneeTab,
        // Onglet visible uniquement pour les rôles ayant cette permission
        // (attribuable via l'écran Rôles & Services). Code renommé depuis
        // 'crm.monopoly' par la migration 20260708170000.
        permission: "crm.tournee",
    },
]

// ── Correspondances URL ↔ état ────────────────────────────────────────────────
// Section d'URL → id d'onglet interne.
const SECTION_TO_TAB: Record<string, string> = {
    agenda: "calendar",
    calendar: "calendar",
    calendrier: "calendar",
    client: "customers",
    clients: "customers",
    customers: "customers",
    tache: "Tache",
    taches: "Tache",
    tasks: "Tache",
    quotes: "quotes",
    devis: "quotes",
    bons: "quotes",
    tournee: "tournee",
    // Ancien nom du jeu : alias conservé pour les URLs déjà partagées.
    monopoly: "tournee",
}
// Id d'onglet → section d'URL canonique.
const TAB_TO_SECTION: Record<string, string> = {
    calendar: "agenda",
    customers: "clients",
    Tache: "tache",
    quotes: "quotes",
    tournee: "tournee",
}
// Segment d'URL → vue calendrier (et inverse, "days" pour le jour).
const VIEW_FROM_URL: Record<string, CalendarView> = {
    day: "day",
    days: "day",
    jour: "day",
    week: "week",
    semaine: "week",
    month: "month",
    mois: "month",
    year: "year",
    annee: "year",
}
const VIEW_TO_URL: Record<CalendarView, string> = {
    day: "days",
    week: "week",
    month: "month",
    year: "year",
}
const CANONICAL_LEAF = new Set(["clients", "quotes", "tache", "tournee"])
// Une URL est "canonique" si elle correspond exactement à une page CRM réelle
// (et pas à un alias ou au /crm nu). On pousse une entrée d'historique entre
// deux pages canoniques (pour que "retour" reste dans le CRM), mais on remplace
// quand on ne fait que normaliser une URL non-canonique (évite une boucle retour).
const isCanonicalCrmPath = (pathname: string): boolean => {
    const seg = pathname.split("/").filter(Boolean) // ["crm", section, detail?]
    if (seg[0] !== "crm" || seg.length < 2) return false
    const [, section, detail] = seg
    if (section === "agenda")
        return !!detail && Object.values(VIEW_TO_URL).includes(detail)
    if (section === "client") return !!detail
    if (CANONICAL_LEAF.has(section)) return !detail
    return false
}

export default function SinglePageCRM() {
    const {
        activeTab,
        setActiveTab,
        calendarView,
        setCalendarView,
        selectedClient,
        setSelectedClient,
        FicheClient,
        setFicheclient,
        setCustomer,
        setClientToOpen,
        clientToOpen,
        fetchOneClient,
        Tache,
    } = useCRMContext()
    const taskCount = Tache?.length || 0

    // Couleur de la bulle de notif "Tache" : rouge si au moins une tâche en
    // retard (priorité absolue), sinon vert s'il y en a pour aujourd'hui —
    // même logique date que getTaskDateType dans TaskPageContext.tsx. Les
    // tâches déjà validées ne comptent pas.
    const { hasLateTask, hasTodayTask } = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let late = false
        let due = false
        for (const t of Tache ?? []) {
            if (t.valide || !t.date) continue
            const d = new Date(t.date)
            d.setHours(0, 0, 0, 0)
            if (d.getTime() < today.getTime()) late = true
            else if (d.getTime() === today.getTime()) due = true
            if (late) break
        }
        return { hasLateTask: late, hasTodayTask: due }
    }, [Tache])

    const params = useParams<{ section?: string; detail?: string }>()
    const navigate = useNavigate()
    const location = useLocation()

    // Onglets filtrés par permission (ex. La Tournée réservée à un rôle).
    const { hasPermission, permissionsLoaded } = useAuth()
    const visibleTabs = useMemo(
        () => tabs.filter((t) => !t.permission || hasPermission(t.permission)),
        [hasPermission]
    )

    // Si l'onglet actif (URL profonde, localStorage) n'est pas autorisé,
    // on retombe sur le calendrier une fois les permissions chargées.
    useEffect(() => {
        if (permissionsLoaded && !visibleTabs.some((t) => t.id === activeTab)) {
            setActiveTab("calendar")
        }
    }, [permissionsLoaded, visibleTabs, activeTab, setActiveTab])

    useEffect(() => {
        localStorage.setItem("activeTab", activeTab)
    }, [activeTab])

    // ── URL → état : applique la route (onglet, vue calendrier, fiche client) ──
    useEffect(() => {
        const section = (params.section || "").toLowerCase()
        const detail = params.detail

        // /crm/client/{id} → ouvre la fiche du client (sauf si déjà ouverte).
        if ((section === "client" || section === "clients") && detail) {
            setActiveTab("customers")
            if (!(FicheClient && selectedClient?.id === detail)) {
                setClientToOpen({ id: detail } as Parameters<
                    typeof setClientToOpen
                >[0])
            }
            return
        }

        const tab = SECTION_TO_TAB[section]
        if (tab) setActiveTab(tab)

        // /crm/agenda/{days|week|month|year} → vue calendrier.
        if (tab === "calendar" && detail) {
            const view = VIEW_FROM_URL[detail.toLowerCase()]
            if (view) setCalendarView(view)
        }
    }, [params.section, params.detail])

    // ── État → URL : maintient une URL canonique et partageable ───────────────
    // PUSH pour les transitions internes (onglet, ouverture fiche) afin que le
    // bouton "retour" revienne à la page CRM précédente ; REPLACE seulement pour
    // normaliser une URL non-canonique ou à la fermeture d'une fiche.
    const prevFicheRef = useRef(false)
    useEffect(() => {
        let path: string
        if (FicheClient && selectedClient?.id) {
            path = `/crm/client/${selectedClient.id}`
        } else if (activeTab === "calendar") {
            path = `/crm/agenda/${VIEW_TO_URL[calendarView]}`
        } else {
            path = `/crm/${TAB_TO_SECTION[activeTab] || "agenda"}`
        }
        if (location.pathname !== path) {
            const closingFiche = prevFicheRef.current && !FicheClient
            const replace =
                closingFiche || !isCanonicalCrmPath(location.pathname)
            navigate(path, { replace })
        }
        prevFicheRef.current = FicheClient
    }, [activeTab, calendarView, FicheClient, selectedClient?.id])

    // Deep-link depuis les notifications (/crm?tab=Tache, ?tab=calendar, …) :
    // ouvre l'onglet ciblé si le paramètre correspond à un onglet connu.
    const [searchParams] = useSearchParams()
    useEffect(() => {
        const tab = searchParams.get("tab")
        if (tab && visibleTabs.some((t) => t.id === tab)) {
            setActiveTab(tab)
        }
    }, [searchParams, setActiveTab, visibleTabs])

    // Ouverture de la fiche : on hydrate immédiatement avec les champs surface
    // (déjà présents dans clientToOpen) puis on charge en arrière-plan la version
    // complète depuis Supabase et on remplace dès qu'elle arrive.
    //
    // ⚠️ Pas de cleanup `cancelled = true` ici : on appelle setClientToOpen(null)
    // pour réarmer le trigger, ce qui RELANCE le useEffect, et son cleanup
    // annulerait l'hydratation en cours (perte des champs lourds : message,
    // adresse_*, commandes, depense…). À la place, on track le dernier id
    // hydraté via un ref et on ignore les réponses obsolètes au resolve.
    const lastHydrationIdRef = useRef<string | null>(null)

    // Quand la fiche se ferme, on réautorise toutes les ouvertures (y compris
    // le même client). Sans ça, le guard `id === lastHydrationIdRef.current`
    // bloque la réouverture du même client après fermeture.
    useEffect(() => {
        if (!FicheClient) {
            lastHydrationIdRef.current = null
        }
    }, [FicheClient])

    useEffect(() => {
        if (!clientToOpen) return
        // clientToOpen peut être un id nu (string) ou un objet client optimiste.
        // Seul le cas objet fournit un id et un client affichable.
        const initial = typeof clientToOpen === "object" ? clientToOpen : null
        const id = initial && "id" in initial ? initial.id : null

        if (id && id === lastHydrationIdRef.current) {
            // Déjà traité (re-run après setClientToOpen(null)).
            return
        }
        if (id) lastHydrationIdRef.current = id

        // Client optimiste minimal (id + nom) le temps que fetchOneClient
        // charge la fiche complète ; les autres champs restent nuls.
        const initialClient: Client | null = initial
            ? {
                  id: initial.id,
                  nom: initial.nom,
                  societe: null,
                  telephone: null,
                  mail: null,
                  siret: null,
                  localisation: null,
              }
            : null

        setSelectedClient(initialClient)
        setCustomer(initialClient ?? undefined)
        setFicheclient(true)
        setClientToOpen(null)

        if (!id) return

        fetchOneClient(id)
            .then((full) => {
                if (!full) return
                // Si l'utilisateur a ouvert un autre client entre temps,
                // on ne stomp pas le nouvel état.
                if (lastHydrationIdRef.current !== id) return
                setSelectedClient(full)
                setCustomer(full)
            })
            .catch((err) => {
                console.error("Erreur chargement fiche client complète:", err)
            })
    }, [
        clientToOpen,
        setSelectedClient,
        setCustomer,
        setFicheclient,
        setClientToOpen,
        fetchOneClient,
    ])

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="flex-1 min-h-0 p-6 flex flex-col">
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex-1 min-h-0 flex flex-col"
                >
                    <TabsList
                        indicator
                        indicatorClassName="inset-y-1 rounded-lg"
                        className="shrink-0 flex flex-row h-auto max-h-15 bg-muted/65 w-full mb-4 px-2 border border-border shadow-sm"
                    >
                        {visibleTabs.map((tab) => (
                            <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                className="flex flex-1 flex-col gap-1.5 px-3 py-6"
                            >
                                <span className="relative">
                                    <tab.icon className="h-4 w-4" />
                                    {tab.id === "Tache" && taskCount > 0 && (
                                        <Badge
                                            variant={
                                                hasLateTask
                                                    ? "destructive"
                                                    : "secondary"
                                            }
                                            className={cn(
                                                "absolute -top-2 -right-2.5 h-4 min-w-4 items-center justify-center rounded-full p-0 text-[10px] leading-none",
                                                !hasLateTask &&
                                                    hasTodayTask &&
                                                    "bg-success text-success-foreground border-transparent"
                                            )}
                                        >
                                            {taskCount > 99 ? "99+" : taskCount}
                                        </Badge>
                                    )}
                                </span>
                                <span className="text-xs hidden sm:inline">
                                    {tab.label}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {visibleTabs.map((tab) => (
                        <TabsContent
                            key={tab.id}
                            value={tab.id}
                            className={cn(
                                // Le fondu d'activation vient de la base de TabsContent
                                // (DESIGN_SYSTEM.md §13) : il était ici recopié avec une
                                // durée de 1s, divergente des 300ms des 3 autres onglets.
                                //
                                // Le calendrier gère lui-même son scroll interne (grille) : il doit
                                // remplir la hauteur restante sans faire scroller la page entière.
                                // Les autres onglets gardent leur flux naturel (scroll de page).
                                tab.id === "calendar" &&
                                    "flex-1 min-h-0 flex flex-col"
                            )}
                        >
                            <CrmErrorBoundary name={tab.label}>
                                <Suspense
                                    fallback={
                                        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                                            Chargement…
                                        </div>
                                    }
                                >
                                    {tab.id === "customers" ? (
                                        <CustomersTab />
                                    ) : tab.id === "calendar" ? (
                                        <CalendarTab />
                                    ) : (
                                        <tab.component />
                                    )}
                                </Suspense>
                            </CrmErrorBoundary>
                        </TabsContent>
                    ))}
                </Tabs>

                {FicheClient && (
                    <CustomerDetailDialog
                        open={FicheClient}
                        setficheclient={setFicheclient}
                    />
                )}
            </div>
        </div>
    )
}
