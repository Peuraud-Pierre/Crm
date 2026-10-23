import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Search } from "@/features/crm/hooks/CRM_hook/use_client"
import { type Devis } from "@/features/crm/hooks/CRM_hook/use_devis"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    Briefcase,
    Euro,
    Headphones,
    type LucideProps,
    TrendingUp,
} from "lucide-react"
import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { LiquidTabsIndicator } from "@/shared/ui/molecules/liquid-tabs-indicator"
import { COLUMN_NAMES } from "@/shared/utils/CrmTab"

// --- CONFIGURATION DU PIPELINE GLOBAL ---
// COLUMN_NAMES vient de la source partagée (@/shared/utils/CrmTab), la même
// que le Kanban (KanbanColumn/CustomerBoard) — une copie locale avait déjà
// divergé (ex. "Client Actif" vs "Fidélisation / Client Actif" pour l'étape 6).
// Index 0-9, cf. commentaires dans CrmTab.ts pour le détail par étape.

// Définition des plages d'index pour chaque mode
const PIPELINE_RANGES = {
    setter: [0, 1, 2, 3, 7],
    closer: [3, 4, 5, 6, 7],
}

interface ClientStatsProps {
    totalOrders: number
    totalSpent: number
    avgOrderValue: number
    unpaidAmount: number
    clientDevis: Devis[]
}

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    }).format(val)

// ✅ COMPOSANT PRINCIPAL
export default function ClientStats({
    totalSpent,
    avgOrderValue,
    clientDevis,
}: ClientStatsProps) {
    const { customer, update_fiche_client, search } = useCRMContext()

    // --- STATES ---
    const serverStep = customer?.collum ?? 0
    const [optimisticStep, setOptimisticStep] = useState(serverStep)

    // État pour basculer entre Setter et Closer (par défaut auto selon l'étape actuelle)
    const [pipelineMode, setPipelineMode] = useState<"setter" | "closer">(() =>
        serverStep < 3 || serverStep === 7 ? "setter" : "closer"
    )

    // ✅ États pour la modale d'assignation
    const [assignModalOpen, setAssignModalOpen] = useState(false)
    const [pendingStep, setPendingStep] = useState<number | null>(null)

    const lastServerStepRef = useRef(serverStep)
    const pipelineModeRef = useRef<HTMLDivElement>(null)
    const pipelineStepsRef = useRef<HTMLDivElement>(null)

    // --- EFFETS ---
    // Resynchronisation de l'étape optimiste avec la valeur serveur quand cette
    // dernière change réellement (garde via ref). `optimisticStep` est aussi piloté
    // par les handlers (mise à jour optimiste + rollback), il ne peut donc pas être
    // une simple valeur dérivée : ce setState dans l'effet est volontaire.
    useEffect(() => {
        if (serverStep !== lastServerStepRef.current) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resync de l'état optimiste sur changement serveur
            setOptimisticStep(serverStep)
            // Optionnel : Basculer automatiquement la vue si le statut avance loin (sauf pour Dormant)
            if (
                serverStep >= 3 &&
                serverStep !== 7 &&
                pipelineMode === "setter"
            )
                // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- bascule auto de vue sur avancement serveur
                setPipelineMode("closer")
            lastServerStepRef.current = serverStep
        }
    }, [serverStep, pipelineMode])

    // --- HANDLERS ---
    // --- HANDLERS ---
    // --- HANDLERS ---
    const handleStepClick = async (targetIndex: number) => {
        // 🎯 On cible les phases 3, 4, 5, 6
        const isCloserPhase = targetIndex >= 3 && targetIndex <= 6

        // 🎯 VÉRIFICATION TYPE-SAFE DU CLOSER
        const closerObj = customer?.closers

        // On considère qu'il n'y a pas de closer si l'objet est absent (null/undefined)
        // ou si l'objet est présent mais que son ID est vide ou manquant.
        const hasNoCloser = !closerObj || !closerObj.id || closerObj.id === ""

        // Si on va dans une phase de Closer ET qu'il n'y a pas de Closer valide
        if (isCloserPhase && hasNoCloser) {
            setPendingStep(targetIndex)
            setAssignModalOpen(true)
            return
        }

        // Sinon, mise à jour normale
        setOptimisticStep(targetIndex)
        executeStepUpdate(targetIndex)
    }
    // Fonction qui fait le vrai appel API
    const executeStepUpdate = async (
        index: number,
        closerId: string | null = null
    ) => {
        if (!customer?.id) return

        try {
            // `closers` est typé `Owner | null` sur Client (objet joint en lecture)
            // alors que l'API attend l'UUID (string) en écriture : l'intersection
            // du type de paramètre réduit donc `closers` à `null`, rendant l'écriture
            // de l'UUID impossible à exprimer sans assertion. On construit un payload
            // au runtime correct puis on l'asserte via `unknown` vers le type attendu
            // (au lieu de l'ancien `as any`).
            const payload = {
                id: customer.id,
                collum: index,
                ...(closerId ? { closers: closerId } : {}),
            }

            await update_fiche_client(
                payload as unknown as Parameters<typeof update_fiche_client>[0]
            )
        } catch (e) {
            console.error("❌ Erreur update pipeline:", e)
            setOptimisticStep(serverStep) // Rollback en cas d'échec
        }
    }

    // ✅ CONFIRMATION DE LA MODALE
    const handleAssignConfirm = (selectedUserId: string) => {
        if (pendingStep !== null) {
            setOptimisticStep(pendingStep)
            executeStepUpdate(pendingStep, selectedUserId)
            setAssignModalOpen(false)
            setPendingStep(null)

            // On bascule automatiquement en mode closer après l'assignation
            setPipelineMode("closer")
        }
    }

    const statsData = useMemo(() => {
        const avoirTotal = clientDevis.reduce(
            (sum, q) => sum + (q.Avoir || 0),
            0
        )
        return [
            {
                icon: Euro,
                color: "text-chart-2 bg-chart-2/10",
                value: totalSpent,
                label: "Total dépensé",
                isCurrency: true,
            },
            {
                icon: TrendingUp,
                color: "text-chart-1 bg-chart-1/10",
                value: avgOrderValue,
                label: "Panier moyen",
                isCurrency: true,
            },
            {
                icon: Euro,
                color: "text-chart-5 bg-chart-5/10",
                value: avoirTotal,
                label: "Avoir disponible",
                isCurrency: true,
            },
        ]
    }, [totalSpent, avgOrderValue, clientDevis])

    // --- CALCUL DES ÉTAPES VISIBLES ---
    const currentRange = PIPELINE_RANGES[pipelineMode]

    // Utilisation de .includes() pour gérer les index non-contigus (ex: 0,1,2,3,7)
    const visibleSteps = COLUMN_NAMES.map((name, index) => ({
        name,
        index,
    })).filter((item) => currentRange.includes(item.index))

    return (
        <div className="space-y-4 md:space-y-6">
            {/* GRID STATS */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {statsData.map((stat) => (
                    <StatCard key={stat.label} {...stat} />
                ))}
            </div>

            {/* PIPELINE CONTAINER */}
            <div className="w-full pt-2 flex flex-col gap-2 animate-in fade-in duration-slow">
                {/* HEADER PIPELINE */}
                <div className="flex justify-between items-end px-1">
                    <div className="flex flex-col">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            Pipeline{" "}
                            {pipelineMode === "setter"
                                ? "Prospection"
                                : "Vente"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Étape actuelle :{" "}
                            <span className="font-semibold text-foreground">
                                {COLUMN_NAMES[optimisticStep] || "Inconnu"}
                            </span>
                        </p>
                    </div>

                    {/* BOUTON TOGGLE */}
                    <div
                        ref={pipelineModeRef}
                        className="relative bg-muted p-1 rounded-lg flex items-center gap-1"
                    >
                        <LiquidTabsIndicator
                            containerRef={pipelineModeRef}
                            activeValue={pipelineMode}
                            className="inset-y-1 rounded-md bg-background/85 border-border/50 shadow-sm"
                        />
                        <button
                            data-state={
                                pipelineMode === "setter"
                                    ? "active"
                                    : "inactive"
                            }
                            onClick={() => setPipelineMode("setter")}
                            className={cn(
                                "relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                pipelineMode === "setter"
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Headphones className="w-3 h-3" />
                            <span className="hidden sm:inline">Setter</span>
                        </button>
                        <button
                            data-state={
                                pipelineMode === "closer"
                                    ? "active"
                                    : "inactive"
                            }
                            onClick={() => setPipelineMode("closer")}
                            className={cn(
                                "relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                pipelineMode === "closer"
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Briefcase className="w-3 h-3" />
                            <span className="hidden sm:inline">Closer</span>
                        </button>
                    </div>
                </div>

                {/* BARRE VISUELLE DU PIPELINE */}
                <div
                    ref={pipelineStepsRef}
                    className="flex w-full rounded-lg overflow-hidden border bg-muted/20 h-10 relative shadow-sm"
                >
                    <LiquidTabsIndicator
                        containerRef={pipelineStepsRef}
                        activeValue={String(optimisticStep)}
                        className="inset-y-0 rounded-md bg-primary border-none shadow-none"
                    />
                    {visibleSteps.map((step, visualIndex) => {
                        const isActive = step.index === optimisticStep

                        const isCompleted =
                            pipelineMode === "setter"
                                ? (optimisticStep === 7 && step.index !== 7) ||
                                  (step.index < optimisticStep &&
                                      optimisticStep !== 7)
                                : step.index < optimisticStep

                        const isLast = visualIndex === visibleSteps.length - 1

                        return (
                            <button
                                key={step.name}
                                data-state={isActive ? "active" : "inactive"}
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleStepClick(step.index)
                                }}
                                className={cn(
                                    "flex-1 flex items-center justify-center text-[10px] sm:text-xs font-medium transition-colors relative z-10 group cursor-pointer px-1",
                                    !isLast && "border-r border-border/40",
                                    isActive
                                        ? "text-primary-foreground font-bold"
                                        : isCompleted
                                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                                          : "bg-transparent text-muted-foreground hover:bg-muted/50"
                                )}
                                title={step.name}
                            >
                                <span className="truncate z-10 relative text-center w-full">
                                    <span className="hidden sm:inline truncate px-2">
                                        {step.name}
                                    </span>
                                    <span className="sm:hidden font-bold">
                                        {step.index + 1}
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ✅ MODALE D'ASSIGNATION */}
            <AssignOwnerModal
                open={assignModalOpen}
                onOpenChange={setAssignModalOpen}
                onConfirm={handleAssignConfirm}
                users={search}
                clientName={customer?.nom}
            />
        </div>
    )
}

// ✅ SOUS-COMPOSANT MODALE
const AssignOwnerModal = ({
    open,
    onOpenChange,
    onConfirm,
    users,
    clientName,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (selectedUserId: string) => void
    users: Search[]
    clientName: string | null | undefined
}) => {
    const [selectedUser, setSelectedUser] = useState("")

    // Réinitialise la sélection à la fermeture (plutôt qu'un setState dans un
    // effet déclenché par `open`), pour repartir d'un état propre à la prochaine
    // ouverture.
    const handleOpenChange = (next: boolean) => {
        if (!next) setSelectedUser("")
        onOpenChange(next)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Assignation requise</DialogTitle>
                    <DialogDescription>
                        Pour déplacer{" "}
                        <strong>{clientName || "ce client"}</strong> à cette
                        étape, vous devez assigner un Closer.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Closer responsable
                        </label>
                        <Select
                            value={selectedUser}
                            onValueChange={setSelectedUser}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choisir un closer..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {users && users.length > 0 ? (
                                    users.map((u: Search) => {
                                        const userId = u.user_id || u.id
                                        const userName =
                                            u.name || "Utilisateur sans nom"

                                        if (!userId) return null

                                        return (
                                            <SelectItem
                                                key={String(userId)}
                                                value={String(userId)}
                                            >
                                                {userName}
                                            </SelectItem>
                                        )
                                    })
                                ) : (
                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                        Aucun utilisateur trouvé.
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={() => onConfirm(selectedUser)}
                        disabled={!selectedUser}
                        className="bg-primary text-primary-foreground"
                    >
                        Confirmer et déplacer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const StatCard = memo(function StatCard({
    icon: Icon,
    color,
    value,
    label,
    isCurrency,
}: {
    icon: React.ForwardRefExoticComponent<
        Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
    >
    color: string
    value: number
    label: string
    isCurrency?: boolean
}) {
    return (
        <Card className="p-3 flex items-center gap-3 border-none bg-background shadow-surface">
            <div
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    color
                )}
            >
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-lg md:text-xl font-bold truncate tracking-tight">
                    {isCurrency ? formatCurrency(value) : value}
                </p>
                <p className="text-[11px] md:text-xs text-muted-foreground truncate font-medium">
                    {label}
                </p>
            </div>
        </Card>
    )
})
