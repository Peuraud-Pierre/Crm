import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"
import {
    clearDraft,
    useBriefDraftRecovery,
    writeDraft,
} from "@/features/crm/hooks/useBriefDraft"
import { setUnsavedWork } from "@/shared/lib/appUpdate"
import { type Tache } from "@/features/crm/hooks/CRM_hook/use_tache"
import { mockInvoices } from "@/shared/lib/mock-data"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
// --- IMPORTS UI ---
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
// ------------------
import {
    Edit2,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    Plus,
    Trash2,
    X,
} from "lucide-react"
import {
    type Dispatch,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { toast } from "sonner"

import { CustomerActivityTimeline } from "./Fiche_split/activiter"
import { CustomerShopForm } from "./Fiche_split/colonneBrief"
import ClientSidebar from "./Fiche_split/colonneg"
import { CustomerTabs } from "./Fiche_split/colonner"
import { AddEventModal } from "./Fiche_split/creation_event"
import ClientStats from "./Fiche_split/stats"

const SPECIAL_TYPES = [
    "Relance",
    "Email",
    "A Faire",
    "Nouvelle commande",
    "Suivi Post-Livraison",
]

// Créneaux horaires (pas de 15 min) pour la liste déroulante d'heure des tâches.
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = String(Math.floor(i / 4)).padStart(2, "0")
    const m = String((i % 4) * 15).padStart(2, "0")
    return `${h}:${m}`
})

// Fiche vierge : utilisée à l'ouverture sans client ET au démontage du dialog.
// `fiche` vit dans le contexte CRM (partagé) : sans reset au démontage, le
// brief du client précédent survit à la fermeture et réapparaît/fuit sur le
// client suivant le temps de l'hydratation.
const EMPTY_FICHE: FicheAppro = {
    vendDeja: [], recherche: [], boutiqueType: undefined,
    surface: undefined, plateformes: [], localisationType: undefined,
    vintage: false, vintageDepuis: "", budget: 0,
    approvisionnement: "", type: [], besoinsHomme: [],
    besoinsFemme: [], marques: [], Note: "",
    evaluationRange: [], provenance: "", experience: "",
}

interface CustomerDetailDialogProps {
    open: boolean
    setficheclient: (open: boolean) => void
    setActiveTab?: Dispatch<SetStateAction<string>>
}

export default function CustomerDetailDialog({
    open,
    setficheclient,
    setActiveTab,
}: CustomerDetailDialogProps) {
    const {
        fetch_activite,
        fetchDevisByUser,
        Devis,
        fiche,
        setFiche,
        update_fiche_client,
        customer,
        clientTaches,
        fetch_client_taches,
        activites,
        openEventModal,
        saveTimeout,
        setOpenEventModal,
    } = useCRMContext()

    // Adaptateur pour les enfants legacy qui appellent `setOpenEventModal(true|false)`
    // alors que le state attend l'id du client. true → on ouvre pour le customer
    // courant, false → on ferme.
    const setOpenEventModalBool = useCallback(
        (val: boolean) => {
            if (val && customer?.id) setOpenEventModal(customer.id)
            else if (!val) setOpenEventModal(null)
        },
        [customer?.id, setOpenEventModal]
    )

    const STORAGE_KEY = `fiche_client_${customer?.id}`

    const [showLeftPanel, setShowLeftPanel] = useState(true)
    const [showRightPanel, setShowRightPanel] = useState(false)

    // --- 1. DATA FETCHING ---
    useEffect(() => {
        if (!customer?.id) return
        Promise.all([
            fetch_activite(customer.id),
            fetch_client_taches(customer.id),
            fetchDevisByUser({ type: "client", id: customer.id }),
            // Pas de fetch_calendar_event() : la colonne RDV charge ses propres
            // événements (fetchClientEvents). Recharger l'agenda entier ici
            // remplaçait aussi la vue filtrée de l'onglet Agenda.
        ])
    }, [customer?.id])

    // --- 2. FILTRAGE DES TÂCHES ---
    const clientTasks = useMemo(() => {
        if (!clientTaches || !customer?.id) return []
        return clientTaches.filter((t) => {
            const tClientId =
                typeof t.client === "object" ? t.client?.id : t.client
            return tClientId === customer.id
        })
    }, [clientTaches, customer?.id])

    // --- 3. FILTRAGE DES ACTIVITÉS (POUR LE COMPTEUR) ---
    const clientActivitiesCount = useMemo(() => {
        if (!activites) return 0
        // Si activites est déjà filtré par le fetch_activite(customer.id), on prend .length
        // Sinon on filtre par sécurité :
        return activites.filter((act) => {
            return act.client === customer?.id
        }).length
    }, [activites, customer?.id])

    // --- 4. EVENTS MEMOIZATION ---
    // --- 5. LOGIQUE MÉTIER (STATS) ---
    const stats = useMemo(() => {
        const customerQuotes = Devis.filter(
            (quote) => quote.client_crm?.id === customer?.id
        )
        const customerInvoices = mockInvoices.filter(
            (invoice) => invoice.customerId === customer?.id
        )
        const totalSpent = customerQuotes.reduce(
            (sum, devis) => sum + (Number(devis.totalHT) || 0),
            0
        )
        const unpaidAmount = customerQuotes.reduce((sum, devis) => {
            const totalTTC = Number(devis.totalTTC) || 0
            const dejaPaye = Array.isArray(devis.paiement)
                ? devis.paiement.reduce(
                      (acc: number, p: { amount?: number | string }) => acc + (Number(p.amount) || 0),
                      0
                  )
                : 0
            return sum + Math.max(0, totalTTC - dejaPaye)
        }, 0)
        const avgOrderValue =
            customerQuotes.length > 0 ? totalSpent / customerQuotes.length : 0

        return {
            customerQuotes,
            customerInvoices,
            totalOrders: customerQuotes.length,
            totalSpent,
            unpaidAmount,
            avgOrderValue,
        }
    }, [Devis, customer?.id])

    // --- 6. HANDLERS ---
    // Dernière écriture en attente (debouncée). Conserve le couple
    // {clientId, brief} figé dans la closure du timeout, pour pouvoir la
    // « flusher » (envoyer immédiatement) à la fermeture/démontage du dialog
    // sans dépendre du customer/fiche COURANT du contexte (qui peut déjà avoir
    // changé) → aucune fuite inter-clients.
    const pendingWriteRef = useRef<{ id: string; brief: FicheAppro } | null>(
        null
    )

    const saveFiche = useCallback(
        (updatedFiche: FicheAppro, immediate = false) => {
            if (!customer?.id) return

            // Brouillon local horodaté (purge des fiches parasites incluse).
            // Il est relu au montage par useBriefDraftRecovery si un
            // rechargement inopiné a devancé la sauvegarde debouncée.
            writeDraft(STORAGE_KEY, updatedFiche)

            // Id figé dans la closure : le debounce reste correct même si le
            // customer du contexte change avant le tir du timeout.
            const clientId = customer.id

            // Envoi à la base de données
            if (immediate) {
                pendingWriteRef.current = null
                update_fiche_client({ id: clientId, brief: updatedFiche })
                setUnsavedWork(STORAGE_KEY, false)
                clearDraft(STORAGE_KEY)
                return
            }

            // On mémorise la charge exacte que le timeout écrira, pour un flush
            // éventuel à la fermeture avant l'échéance des 800 ms.
            pendingWriteRef.current = { id: clientId, brief: updatedFiche }

            // Retient une mise à jour de l'app le temps que l'écriture parte :
            // recharger dans cette fenêtre perdait la frappe en cours.
            setUnsavedWork(STORAGE_KEY, true)

            if (saveTimeout.current) clearTimeout(saveTimeout.current)
            saveTimeout.current = setTimeout(() => {
                // Remettre le ref à null une fois la sauvegarde partie :
                // sinon il reste truthy à jamais et tout consommateur qui
                // teste « une sauvegarde est-elle en attente ? » (ex. flush)
                // rejouerait une écriture avec la fiche mémoire périmée.
                saveTimeout.current = null
                pendingWriteRef.current = null
                update_fiche_client({
                    id: clientId,
                    brief: updatedFiche,
                })
                setUnsavedWork(STORAGE_KEY, false)
                // Écriture partie : le brouillon n'a plus rien à rattraper.
                clearDraft(STORAGE_KEY)
            }, 800)
        },
        [customer, update_fiche_client, STORAGE_KEY]
    )

    // FLUSH au démontage : à la fermeture du dialog (ou changement d'onglet
    // qui démonte le formulaire), une sauvegarde debouncée peut encore être en
    // vol. Sans ce flush, fermer < 800 ms après un clic perd l'écriture ET
    // l'update optimiste de `clients` → à la réouverture, la sync relit
    // l'ancien `customer.brief` et le toggle « revient en arrière ».
    // On envoie la charge en attente (clientId + brief figés dans le ref),
    // donc c'est sûr même si le customer courant a déjà changé.
    useEffect(() => {
        return () => {
            if (saveTimeout.current) {
                clearTimeout(saveTimeout.current)
                saveTimeout.current = null
            }
            if (pendingWriteRef.current) {
                update_fiche_client(pendingWriteRef.current)
                pendingWriteRef.current = null
            }
            setUnsavedWork(STORAGE_KEY, false)
        }
    }, [saveTimeout, update_fiche_client, STORAGE_KEY])

    const handleChange = useCallback(
        (field: keyof FicheAppro, value: FicheAppro[keyof FicheAppro]) => {
            setFiche((prev) => {
                const updated = { ...prev, [field]: value }
                saveFiche(updated)
                return updated
            })
        },
        [setFiche, saveFiche]
    )

    // --- 7. SYNC BRIEF FROM CUSTOMER (lifted here to survive tab switches) ---
    // CustomerShopForm is unmounted when the user switches to another tab
    // (Radix UI Tabs unmounts inactive TabsContent by default). If the sync
    // logic lives inside that component, the lastSyncedCustomerId ref is
    // destroyed on unmount, causing the effect to re-run on remount and
    // overwrite local edits with stale server data. Keeping it here ensures
    // the ref persists for the entire dialog lifecycle.
    const lastSyncedCustomerIdRef = useRef<string | null>(null)

    // Reset du brief partagé au DÉMONTAGE : le dialog est monté
    // conditionnellement ({FicheClient && …} dans SinglePageCRM), donc à la
    // fermeture le contexte garderait la fiche du client affiché. On repart
    // vierge pour que rien ne fuie vers la prochaine ouverture.
    useEffect(() => {
        return () => setFiche(EMPTY_FICHE)
    }, [setFiche])

    useEffect(() => {
        if (!customer?.id) {
            setFiche(EMPTY_FICHE)
            lastSyncedCustomerIdRef.current = null
            return
        }

        // Guard: only sync once per customer — don't overwrite local edits
        if (lastSyncedCustomerIdRef.current === customer.id) return

        const briefRaw = customer.brief

        // Placeholder optimiste (SinglePageCRM pose un customer minimal {id,nom}
        // AVANT que fetchOneClient ne résolve la fiche complète) : `brief` est
        // encore `undefined`. On vide la fiche pour ne pas afficher l'ancien
        // client, mais on NE pose PAS le garde → on re-synchronise dès que la
        // fiche complète (brief chargé) arrive. Sinon le brief réel n'était
        // jamais réinjecté à la réouverture (le garde bloquait le 2e passage).
        if (briefRaw === undefined) {
            setFiche(EMPTY_FICHE)
            return
        }

        // Données réelles chargées → hydratation + pose du garde (protège les
        // edits locaux contre les échos Realtime ultérieurs).
        lastSyncedCustomerIdRef.current = customer.id

        const brief =
            briefRaw && typeof briefRaw === "object"
                ? (briefRaw as FicheAppro)
                : ({} as FicheAppro)

        setFiche({
            // Spread raw brief first (preserves all server fields)
            ...brief,
            // Then normalize fields that may arrive in legacy shapes
            vintage:
                typeof brief.vintage === "string"
                    ? brief.vintage === "oui"
                    : !!brief.vintage,
            type: Array.isArray(brief.type)
                ? brief.type
                : typeof brief.type === "string" && brief.type
                  ? [brief.type]
                  : [],
            plateformes: Array.isArray(brief.plateformes)
                ? brief.plateformes
                : [],
            vendDeja: Array.isArray(brief.vendDeja) ? brief.vendDeja : [],
            recherche: Array.isArray(brief.recherche) ? brief.recherche : [],
            besoinsHomme: Array.isArray(brief.besoinsHomme)
                ? brief.besoinsHomme
                : [],
            besoinsFemme: Array.isArray(brief.besoinsFemme)
                ? brief.besoinsFemme
                : [],
            marques: Array.isArray(brief.marques) ? brief.marques : [],
            evaluationRange: Array.isArray(brief.evaluationRange)
                ? brief.evaluationRange
                : [0, 0],
            Matiere: Array.isArray(brief.Matiere) ? brief.Matiere : [],
            provenance: brief.provenance ?? "",
            Note: brief.Note ?? "",
            budget: brief.budget ?? 0,
        })
    // On dépend AUSSI de customer?.brief : le customer passe par une phase
    // « placeholder minimal » (sans brief) puis « complet » (brief chargé)
    // SANS changer d'id. Sans cette dépendance, le brief réel n'était jamais
    // synchronisé à la réouverture. Le garde (lastSyncedCustomerIdRef) empêche
    // toujours les échos Realtime ultérieurs d'écraser les edits locaux.
    }, [customer?.id, customer?.brief, setFiche])

    // Rattrapage : si un rechargement inopiné a devancé la sauvegarde
    // debouncée, un brouillon plus complet que le serveur attend en local.
    // Proposé, jamais réinjecté d'office — l'écraser en silence ferait
    // disparaître ce qu'un collègue aurait modifié entre-temps.
    const handleRestoreDraft = useCallback(
        (restored: FicheAppro) => {
            setFiche(restored)
            saveFiche(restored, true)
        },
        [setFiche, saveFiche]
    )

    useBriefDraftRecovery({
        customerId: customer?.id ?? null,
        serverFiche: customer?.brief === undefined ? null : fiche,
        onRestore: handleRestoreDraft,
    })

    const round2 = useCallback(
        (num: number) => Math.round((num + Number.EPSILON) * 100) / 100,
        []
    )

    return (
        <Dialog open={open} onOpenChange={setficheclient}>
            <DialogContent className="w-[98vw] h-[90dvh] max-w-none rounded-lg p-0 overflow-hidden bg-background">
                <DialogHeader className="sr-only">
                    <DialogTitle>Fiche client : {customer?.nom}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    {/* === MOBILE VIEW === */}
                    <div className="md:hidden w-full h-full overflow-y-auto bg-muted/10">
                        <Tabs
                            defaultValue="sidebar"
                            className="h-full flex flex-col"
                        >
                            <div className="sticky top-0 z-10 bg-background border-b flex items-center">
                                <TabsList
                                    variant="underline"
                                    className="grid grid-cols-3 flex-1 text-xs h-12"
                                >
                                    <TabsTrigger value="sidebar">
                                        Client
                                    </TabsTrigger>
                                    <TabsTrigger value="middle">
                                        Activité ({clientActivitiesCount})
                                    </TabsTrigger>
                                    <TabsTrigger value="right">
                                        Factures
                                    </TabsTrigger>
                                </TabsList>
                                <button
                                    onClick={() => setficheclient(false)}
                                    className="h-12 w-12 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Fermer"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <TabsContent
                                value="sidebar"
                                className="flex-1 p-4 mt-0"
                            >
                                <ClientSidebar
                                    setOpenEventModal={setOpenEventModalBool}
                                />
                            </TabsContent>
                            <TabsContent
                                value="middle"
                                className="flex-1 p-4 mt-0 space-y-4"
                            >
                                <ClientStats
                                    totalOrders={stats.totalOrders}
                                    totalSpent={stats.totalSpent}
                                    avgOrderValue={stats.avgOrderValue}
                                    unpaidAmount={stats.unpaidAmount}
                                    clientDevis={stats.customerQuotes}
                                />
                                <Card className="border rounded-xl flex flex-col overflow-hidden bg-background shadow-sm">
                                    <Tabs
                                        defaultValue="brief"
                                        className="flex flex-col"
                                    >
                                        <TabsList indicator className="grid grid-cols-3 w-full border-b h-11 bg-muted/40">
                                            <TabsTrigger
                                                value="brief"
                                                className="text-xs"
                                            >
                                                Brief
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="activity"
                                                className="text-xs"
                                            >
                                                Timeline (
                                                {clientActivitiesCount})
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="task"
                                                className="text-xs"
                                            >
                                                Tâches ({clientTasks.length})
                                            </TabsTrigger>
                                        </TabsList>
                                        <div className="p-4">
                                            <TabsContent
                                                value="activity"
                                                className="mt-0"
                                            >
                                                <CustomerActivityTimeline
                                                    setOpenEventModal={
                                                        setOpenEventModalBool
                                                    }
                                                />
                                            </TabsContent>
                                            <TabsContent
                                                value="brief"
                                                className="mt-0"
                                            >
                                                <CustomerShopForm
                                                    handleChange={handleChange}
                                                    saveFiche={saveFiche}
                                                />
                                            </TabsContent>
                                            <TabsContent
                                                value="task"
                                                className="mt-0"
                                            >
                                                <TasksList
                                                    tasks={clientTasks}
                                                />
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </Card>
                            </TabsContent>
                            <TabsContent
                                value="right"
                                className="flex-1 p-4 mt-0"
                            >
                                <CustomerTabs
                                    customerQuotes={stats.customerQuotes}
                                    customerInvoices={stats.customerInvoices}
                                    round2={round2}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* === DESKTOP VIEW === */}
                    <div className="hidden md:flex flex-1 overflow-hidden bg-muted/5 relative">
                        <div
                            className={cn(
                                // transition-[width,opacity] plutôt que transition-all : n'anime
                                // que ce qui doit l'être, will-change-[width] hinte le bon
                                // property (pas -transform, qui ne correspond à rien ici).
                                "shrink-0 border-r bg-background overflow-y-auto will-change-[width] transition-[width,opacity] duration-slow ease-in-out",
                                showLeftPanel
                                    ? "w-[320px] xl:w-[380px] opacity-100"
                                    : "w-0 opacity-0 -translate-x-full border-none"
                            )}
                        >
                            {/* [contain:layout_paint] : isole le layout/paint du contenu
                                (largeur fixe) de celui du parent qui anime sa largeur — sans
                                ça le navigateur recalcule tout le contenu à chaque frame de
                                la transition, d'où le côté saccadé. */}
                            <div
                                className="w-[320px] xl:w-[380px] animate-in fade-in slide-in-from-left-12 duration-slower ease-overshoot [contain:layout_paint]"
                            >
                                <ClientSidebar
                                    setOpenEventModal={setOpenEventModalBool}
                                />
                            </div>
                        </div>

                        <div
                            style={{ animationDelay: "80ms" }}
                            className="flex-1 flex flex-col p-4 xl:p-6 space-y-4 overflow-hidden min-w-0 animate-in fade-in slide-in-from-left-12 fill-mode-backwards duration-slower ease-overshoot"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setShowLeftPanel(!showLeftPanel)
                                    }
                                    className="h-8 gap-2 text-muted-foreground hover:!text-foreground dark:hover:!text-foreground"
                                >
                                    {showLeftPanel ? (
                                        <>
                                            <PanelLeftClose className="w-4 h-4" />{" "}
                                            <span className="text-xs">
                                                Fermer
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <PanelLeftOpen className="w-4 h-4" />{" "}
                                            <span className="text-xs">
                                                Client
                                            </span>
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setShowRightPanel(!showRightPanel)
                                    }
                                    className="h-8 gap-2 text-muted-foreground hover:!text-foreground dark:hover:!text-foreground"
                                >
                                    {showRightPanel ? (
                                        <>
                                            <span className="text-xs">
                                                Fermer
                                            </span>{" "}
                                            <PanelRightClose className="w-4 h-4" />
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs">
                                                Facturation
                                            </span>{" "}
                                            <PanelRightOpen className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </div>

                            <ClientStats
                                totalOrders={stats.totalOrders}
                                totalSpent={stats.totalSpent}
                                avgOrderValue={stats.avgOrderValue}
                                unpaidAmount={stats.unpaidAmount}
                                clientDevis={stats.customerQuotes}
                            />

                            <Card className="flex-1 flex flex-col border shadow-sm bg-background overflow-hidden">
                                <Tabs
                                    defaultValue="brief"
                                    onValueChange={setActiveTab}
                                    className="flex flex-col h-full"
                                >
                                    <div className="px-4 py-2 border-b bg-muted/10 flex justify-between items-center">
                                        <TabsList indicator className="bg-muted/50">
                                            <TabsTrigger value="brief">
                                                Brief & Infos
                                            </TabsTrigger>
                                            <TabsTrigger value="activity">
                                                Activité (
                                                {clientActivitiesCount})
                                            </TabsTrigger>
                                            <TabsTrigger value="task">
                                                Tâches ({clientTasks.length})
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 bg-gray/50">
                                        <TabsContent
                                            value="activity"
                                            className="mt-0 h-full"
                                        >
                                            <CustomerActivityTimeline
                                                setOpenEventModal={
                                                    setOpenEventModalBool
                                                }
                                            />
                                        </TabsContent>
                                        <TabsContent
                                            value="brief"
                                            className="mt-0 h-full"
                                        >
                                            <CustomerShopForm
                                                handleChange={handleChange}
                                                saveFiche={saveFiche}
                                            />
                                        </TabsContent>
                                        <TabsContent
                                            value="task"
                                            className="mt-0 h-full"
                                        >
                                            <TasksList tasks={clientTasks} />
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </Card>
                        </div>

                        <div
                            className={cn(
                                "shrink-0 border-l bg-background overflow-y-auto will-change-[width] transition-[width,opacity] duration-slow ease-in-out",
                                showRightPanel
                                    ? "w-[350px] 2xl:w-[400px] opacity-100"
                                    : "w-0 opacity-0 translate-x-full border-none"
                            )}
                        >
                            <div
                                style={{ animationDelay: "160ms" }}
                                className="w-[350px] 2xl:w-[400px] p-4 animate-in fade-in slide-in-from-left-12 fill-mode-backwards duration-slower ease-overshoot [contain:layout_paint]"
                            >
                                <CustomerTabs
                                    customerQuotes={stats.customerQuotes}
                                    customerInvoices={stats.customerInvoices}
                                    round2={round2}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <AddEventModal
                    client={customer}
                    open={openEventModal === customer?.id}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) {
                            setOpenEventModal(null)
                        }
                    }}
                />
            </DialogContent>
        </Dialog>
    )
}

// ------------------------------------------------------------------
// --- COMPOSANT TASKS LIST ---
// ------------------------------------------------------------------

const TasksList = ({ tasks }: { tasks: Tache[] }) => {
    const { user } = useAuth()
    const { delete_Tache, update_Tache, create_Tache, customer, search } =
        useCRMContext()

    const [editTask, setEditTask] = useState<Tache | null>(null)
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
    const [openEditModal, setOpenEditModal] = useState(false)
    const [openCreateModal, setOpenCreateModal] = useState(false)
    const [newTask, setNewTask] = useState({
        type: "",
        owner: "",
        date: new Date().toISOString().slice(0, 10),
        time: "",
        content: "",
    })

    // Affectation par défaut : l'utilisateur courant (modifiable).
    useEffect(() => {
        if (user?.user_id) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- affectation par défaut (owner) ensuite éditable par l'utilisateur, garde d'idempotence présente
            setNewTask((p) => (p.owner ? p : { ...p, owner: user.user_id }))
        }
    }, [user?.user_id])

    const handleCreateTask = async () => {
        if (!newTask.type || !newTask.content || !customer?.id) return
        const taskDate = new Date(
            `${newTask.date || new Date().toISOString().slice(0, 10)}T${newTask.time || "00:00"}`
        )
        if (isNaN(taskDate.getTime())) {
            toast.error("Date invalide")
            return
        }
        try {
            await create_Tache({
                type: newTask.type,
                content: newTask.content,
                date: taskDate.toISOString(),
                client: customer.id,
                owner: newTask.owner || user?.user_id,
            } as Tache)
            setNewTask({
                type: "",
                owner: user?.user_id ?? "",
                date: new Date().toISOString().slice(0, 10),
                time: "",
                content: "",
            })
            setOpenCreateModal(false)
            toast.success("Tâche créée avec succès")
        } catch {
            toast.error("Erreur lors de la création")
        }
    }

    const saveEditTask = async () => {
        if (!editTask || !editTask.id) return
        try {
            const clientId =
                typeof editTask.client === "object" && editTask.client
                    ? editTask.client.id
                    : (editTask.client as string)
            await update_Tache(editTask.id, {
                type: editTask.type,
                date: editTask.date,
                content: editTask.content,
                valide: editTask.valide,
                owner: editTask.owner,
                client: clientId,
            })
            setOpenEditModal(false)
            setEditTask(null)
            toast.success("Tâche modifiée")
        } catch {
            toast.error("Erreur")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ?")) return
        setIsDeletingId(id)
        try {
            await delete_Tache(id)
            toast.success("Supprimée")
        } catch {
            toast.error("Erreur")
        } finally {
            setIsDeletingId(null)
        }
    }

    const getTaskStyle = (type: string) => {
        const t = type.toLowerCase()
        if (t.includes("appel"))
            return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30"
        if (t.includes("email") || t.includes("whatsapp"))
            return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30"
        if (t.includes("commande"))
            return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30"
        if (t.includes("relance"))
            return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30"
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-200"
    }

    return (
        <div className="flex flex-col gap-4">
            <Button
                onClick={() => setOpenCreateModal(true)}
                className="w-full bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 border shadow-none h-11 rounded-xl font-bold"
            >
                <Plus className="mr-2 h-4 w-4" /> Ajouter une Tâche
            </Button>

            {!tasks || tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground">
                    <p className="text-sm">Aucune tâche planifiée</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {tasks.map((t) => (
                        <div
                            key={t.id}
                            className={cn(
                                "group relative flex flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-muted/20",
                                t.valide && "opacity-60 bg-muted/30"
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            "rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border",
                                            getTaskStyle(t.type)
                                        )}
                                    >
                                        {t.type}
                                    </span>
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                        {t.date
                                            ? new Date(
                                                  t.date
                                              ).toLocaleDateString()
                                            : "Sans date"}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                            setEditTask(t)
                                            setOpenEditModal(true)
                                        }}
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive"
                                        onClick={() => handleDelete(t.id)}
                                        loading={isDeletingId === t.id}
                                    >
                                        {isDeletingId !== t.id && (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                            <span
                                className={cn(
                                    "whitespace-pre-wrap text-sm leading-snug text-foreground/80",
                                    t.valide && "line-through"
                                )}
                            >
                                {t.content}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* MODALES CREATION / EDITION */}
            <Dialog
                open={openCreateModal || openEditModal}
                onOpenChange={(o) => {
                    setOpenCreateModal(o)
                    if (!o) setOpenEditModal(false)
                }}
            >
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {openEditModal
                                ? "Modifier la tâche"
                                : "Créer une tâche"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">
                                Type
                            </label>
                            <select
                                value={
                                    openEditModal
                                        ? editTask?.type
                                        : newTask.type
                                }
                                onChange={(e) =>
                                    openEditModal
                                        ? setEditTask({
                                              ...editTask!,
                                              type: e.target.value,
                                          })
                                        : setNewTask({
                                              ...newTask,
                                              type: e.target.value,
                                          })
                                }
                                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                            >
                                <option value="" disabled>
                                    Choisir...
                                </option>
                                {SPECIAL_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">
                                Attribuer à
                            </label>
                            <select
                                value={
                                    openEditModal
                                        ? (editTask?.owner ?? "")
                                        : newTask.owner
                                }
                                onChange={(e) =>
                                    openEditModal
                                        ? setEditTask({
                                              ...editTask!,
                                              owner: e.target.value,
                                          })
                                        : setNewTask({
                                              ...newTask,
                                              owner: e.target.value,
                                          })
                                }
                                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                            >
                                <option value="" disabled>
                                    Choisir...
                                </option>
                                {search?.map((u) => (
                                    <option key={u.user_id} value={u.user_id}>
                                        {u.name}
                                        {u.user_id === user?.user_id && " (moi)"}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">
                                    Date
                                </label>
                                <Input
                                    type="date"
                                    // Clic n'importe où sur le champ → ouvre le
                                    // calendrier natif (pas seulement l'icône).
                                    onClick={(e) =>
                                        e.currentTarget.showPicker?.()
                                    }
                                    className="cursor-pointer"
                                    value={
                                        openEditModal
                                            ? (() => {
                                                  if (!editTask?.date) return ""
                                                  const d = new Date(
                                                      editTask.date
                                                  )
                                                  return isNaN(d.getTime())
                                                      ? ""
                                                      : d
                                                            .toISOString()
                                                            .split("T")[0]
                                              })()
                                            : newTask.date
                                    }
                                    onChange={(e) =>
                                        openEditModal
                                            ? setEditTask({
                                                  ...editTask!,
                                                  date: e.target.value,
                                              })
                                            : setNewTask({
                                                  ...newTask,
                                                  date: e.target.value,
                                              })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">
                                    Heure
                                </label>
                                <select
                                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm cursor-pointer"
                                    value={
                                        openEditModal
                                            ? editTask?.date
                                                ? new Date(editTask.date)
                                                      .toTimeString()
                                                      .slice(0, 5)
                                                : ""
                                            : newTask.time
                                    }
                                    onChange={(e) => {
                                        if (openEditModal && editTask?.date) {
                                            const base = new Date(editTask.date)
                                            if (isNaN(base.getTime())) return
                                            const datePart = base
                                                .toISOString()
                                                .split("T")[0]
                                            const next = new Date(
                                                `${datePart}T${e.target.value}`
                                            )
                                            if (isNaN(next.getTime())) return
                                            setEditTask({
                                                ...editTask!,
                                                date: next.toISOString(),
                                            })
                                        } else {
                                            setNewTask({
                                                ...newTask,
                                                time: e.target.value,
                                            })
                                        }
                                    }}
                                >
                                    <option value="">--:--</option>
                                    {TIME_OPTIONS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">
                                Contenu
                            </label>
                            <Input
                                placeholder="Description..."
                                value={
                                    openEditModal
                                        ? editTask?.content || "" // 👈 Ajout du || "" juste ici !
                                        : newTask.content || ""
                                }
                                onChange={(e) =>
                                    openEditModal
                                        ? setEditTask({
                                              ...editTask!,
                                              content: e.target.value,
                                          })
                                        : setNewTask({
                                              ...newTask,
                                              content: e.target.value,
                                          })
                                }
                            />
                        </div>
                        {openEditModal && (
                            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
                                <Checkbox
                                    checked={editTask?.valide || false}
                                    onCheckedChange={(c) =>
                                        setEditTask({
                                            ...editTask!,
                                            valide: !!c,
                                        })
                                    }
                                />
                                <span className="text-sm font-medium">
                                    Marquer comme terminée
                                </span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setOpenCreateModal(false)
                                setOpenEditModal(false)
                            }}
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={
                                openEditModal ? saveEditTask : handleCreateTask
                            }
                        >
                            {openEditModal ? "Enregistrer" : "Créer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
