import { memo, useCallback, useMemo } from "react"
import { List, type RowComponentProps } from "react-window"
import { useCustomers } from "@/features/crm/context/CustomerContext"
import { Button } from "@/shared/ui/atoms/button"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { cn } from "@/shared/lib/utils"
import { COLUMN_NAMES, getExperienceBgClasses } from "@/shared/utils/CrmTab"
import {
    Clock,
    User as UserIcon,
    Users,
    ChevronDown,
    GraduationCap,
} from "lucide-react"
import { LiveTimer } from "./LiveTimer"
import { isFicheAppro } from "@/features/crm/utils/invariants"
import type { TaskStatus } from "@/features/crm/utils/crmCompute"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

// Colonnes dans l'ordre d'affichage, avec leur largeur de grille et leur
// largeur minimale (utilisée pour calculer la largeur totale scrollable).
const COLUMN_ORDER = [
    "client",
    "setters",
    "closers",
    "etape",
    "budget",
    "experience",
    "activite",
    "contact",
    "maj",
    "timer",
] as const

const COLUMN_GRID_WIDTH: Record<(typeof COLUMN_ORDER)[number], string> = {
    client: "minmax(220px,1fr)",
    setters: "130px",
    closers: "130px",
    etape: "110px",
    budget: "90px",
    experience: "120px",
    activite: "100px",
    contact: "minmax(160px,1fr)",
    maj: "80px",
    timer: "90px",
}

const COLUMN_MIN_PX: Record<(typeof COLUMN_ORDER)[number], number> = {
    client: 220,
    setters: 130,
    closers: 130,
    etape: 110,
    budget: 90,
    experience: 120,
    activite: 100,
    contact: 160,
    maj: 80,
    timer: 90,
}

const ROW_HEIGHT = 48

// --- SOUS-COMPOSANT : LIGNE DU TABLEAU (row react-window) ---
interface RowProps {
    clients: Client[]
    clientTaskMap: Map<string, TaskStatus>
    visibleColumns: Record<string, boolean>
    gridTemplateColumns: string
    onClientClick: (client: Client) => void
}

const Row = ({
    index,
    style,
    clients,
    clientTaskMap,
    visibleColumns,
    gridTemplateColumns,
    onClientClick,
}: RowComponentProps<RowProps>) => {
    const client = clients[index]
    if (!client) return null

    const isNew = !client.prise_en_charge
    const taskStatus =
        (client.id && clientTaskMap.get(client.id)) || ("none" as TaskStatus)

    // Mémoïsé au niveau du composant serait idéal, mais react-window ne
    // fournit pas de wrapper mémoïsable par ligne ici — le calcul reste
    // trivial (accès direct au brief déjà normalisé côté service).
    const brief = isFicheAppro(client.brief) ? client.brief : null
    const displayBudget = brief?.budget || null
    const rawExperience = brief?.experience ?? null
    const activite = brief?.activiteType ?? null

    return (
        <div style={style} className="px-0">
            <div
                role="row"
                style={{
                    gridTemplateColumns,
                    animationDelay: `${Math.min(index * 30, 300)}ms`,
                }}
                className="grid h-12 items-center border-b border-border/40 cursor-pointer hover:bg-muted/60 transition-colors animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
                onClick={() => onClientClick(client)}
            >
                {visibleColumns.client && (
                    <div
                        role="cell"
                        className="h-full flex items-center py-2 pl-4 pr-6 border-l border-r border-border/40 bg-muted/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 flex items-center justify-center w-2.5">
                                {taskStatus === "red" && (
                                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_hsl(var(--destructive)/0.6)]" />
                                )}
                                {taskStatus === "green" && (
                                    <div className="h-2 w-2 rounded-full bg-success" />
                                )}
                                {taskStatus === "gray" && (
                                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="truncate max-w-[250px] text-sm font-semibold text-foreground/90 leading-tight">
                                    {client.nom}
                                </span>
                                {client.societe && (
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate max-w-[200px]">
                                        {client.societe}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {visibleColumns.setters && (
                    <div
                        role="cell"
                        className="h-full flex items-center text-xs whitespace-nowrap pl-4 pr-2 py-2"
                    >
                        {client.customer?.full_name ? (
                            <span className="font-medium text-foreground/80 bg-primary/5 px-2 py-1 rounded-md text-[11px] border border-primary/10">
                                {client.customer.full_name}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/20 text-[10px] pl-2">
                                -
                            </span>
                        )}
                    </div>
                )}

                {visibleColumns.closers && (
                    <div
                        role="cell"
                        className="h-full flex items-center text-xs whitespace-nowrap px-2 py-2"
                    >
                        {client.closers?.full_name ? (
                            <span className="font-medium text-chart-5 bg-chart-5/10 px-2 py-1 rounded-md text-[11px] border border-chart-5/20">
                                {client.closers.full_name}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/20 text-[10px] pl-2">
                                -
                            </span>
                        )}
                    </div>
                )}

                {visibleColumns.etape && (
                    <div
                        role="cell"
                        className="h-full flex items-center justify-center whitespace-nowrap px-4 py-2"
                    >
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-sm text-[10px] font-medium bg-secondary/80 text-secondary-foreground">
                            {COLUMN_NAMES[client.collum || 0]}
                        </span>
                    </div>
                )}

                {visibleColumns.budget && (
                    <div
                        role="cell"
                        className="h-full flex items-center whitespace-nowrap px-3 py-2"
                    >
                        {displayBudget ? (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success">
                                {displayBudget} €
                            </span>
                        ) : (
                            <span className="text-muted-foreground/20 text-[10px]">
                                -
                            </span>
                        )}
                    </div>
                )}

                {visibleColumns.experience && (
                    <div
                        role="cell"
                        className="h-full flex items-center whitespace-nowrap px-3 py-2"
                    >
                        {rawExperience ? (
                            <span
                                className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-md",
                                    getExperienceBgClasses(rawExperience) ||
                                        "bg-chart-2/10 text-chart-2"
                                )}
                            >
                                {rawExperience}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/20 text-[10px]">
                                -
                            </span>
                        )}
                    </div>
                )}

                {visibleColumns.activite && (
                    <div
                        role="cell"
                        className="h-full flex items-center text-muted-foreground text-xs whitespace-nowrap px-3 py-2"
                    >
                        {activite ? (
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                {activite}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/20 text-[10px]">
                                -
                            </span>
                        )}
                    </div>
                )}

                {visibleColumns.contact && (
                    <div
                        role="cell"
                        className="h-full flex items-center text-xs px-3 py-2 min-w-0"
                    >
                        <div className="flex flex-col gap-0.5 max-w-[180px]">
                            {client.telephone ? (
                                <span className="font-medium text-foreground/80 leading-none">
                                    {client.telephone}
                                </span>
                            ) : (
                                <span className="text-muted-foreground/20 text-[10px]">
                                    No phone
                                </span>
                            )}
                            {client.mail && (
                                <span className="text-muted-foreground text-[10px] truncate hover:text-primary transition-colors leading-none">
                                    {client.mail}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {visibleColumns.maj && (
                    <div
                        role="cell"
                        className="h-full flex items-center text-xs text-muted-foreground whitespace-nowrap px-3 py-2 font-mono"
                    >
                        {client.updated_at
                            ? new Date(client.updated_at).toLocaleDateString(
                                  undefined,
                                  { day: "2-digit", month: "2-digit" }
                              )
                            : "-"}
                    </div>
                )}

                {visibleColumns.timer && (
                    <div
                        role="cell"
                        className="h-full flex items-center justify-end whitespace-nowrap px-3 py-2 pr-4"
                    >
                        {isNew ? (
                            <div className="scale-90 origin-right">
                                <LiveTimer
                                    startDate={client.created_at || ""}
                                />
                            </div>
                        ) : (
                            <span className="text-muted-foreground/20 text-[10px]">
                                -
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// --- COMPOSANT PRINCIPAL : VUE TABLEAU ---
interface ClientsTableViewProps {
    clients: Client[]
    clientTaskMap: Map<string, TaskStatus>
    onClientClick: (client: Client) => void
    visibleColumns: Record<string, boolean>
}

export const ClientsTableView = memo(function ClientsTableView({
    clients,
    clientTaskMap,
    onClientClick,
    visibleColumns,
}: ClientsTableViewProps) {
    const { loadMoreClients, hasMoreClients, isLoadingMoreClients } =
        useCustomers()
    const handleLoadMore = useCallback(
        () => void loadMoreClients(),
        [loadMoreClients]
    )

    const visibleColumnKeys = useMemo(
        () => COLUMN_ORDER.filter((c) => visibleColumns[c]),
        [visibleColumns]
    )

    const gridTemplateColumns = useMemo(
        () => visibleColumnKeys.map((c) => COLUMN_GRID_WIDTH[c]).join(" "),
        [visibleColumnKeys]
    )

    const totalMinWidth = useMemo(
        () =>
            visibleColumnKeys.reduce(
                (sum, c) => sum + COLUMN_MIN_PX[c],
                0
            ),
        [visibleColumnKeys]
    )

    const rowProps = useMemo<RowProps>(
        () => ({
            clients,
            clientTaskMap,
            visibleColumns,
            gridTemplateColumns,
            onClientClick,
        }),
        [clients, clientTaskMap, visibleColumns, gridTemplateColumns, onClientClick]
    )

    // Déclenche le fetch suivant quand la virtualisation approche de la fin
    // de la liste chargée en mémoire — remplace l'ancien sentinel
    // IntersectionObserver, devenu inutile puisque react-window sait déjà
    // quelles lignes sont visibles.
    const handleRowsRendered = useCallback(
        ({ stopIndex }: { startIndex: number; stopIndex: number }) => {
            if (
                !isLoadingMoreClients &&
                hasMoreClients &&
                stopIndex >= clients.length - 5
            ) {
                void loadMoreClients()
            }
        },
        [isLoadingMoreClients, hasMoreClients, clients.length, loadMoreClients]
    )

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-x-auto">
                <div
                    role="table"
                    className="flex flex-col h-full pb-4"
                    style={{ minWidth: totalMinWidth }}
                >
                    <div
                        role="row"
                        style={{ gridTemplateColumns }}
                        className="grid h-10 shrink-0 items-center bg-muted/50 sticky top-0 z-10 backdrop-blur-sm shadow-sm border-b border-border/60"
                    >
                        {visibleColumns.client && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap pl-4 pr-2 text-left text-xs font-medium text-muted-foreground"
                            >
                                Client
                            </div>
                        )}
                        {visibleColumns.setters && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap pl-4 pr-2 text-left"
                            >
                                <div className="flex items-center gap-1.5 opacity-80">
                                    <Users className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">
                                        Setters
                                    </span>
                                </div>
                            </div>
                        )}
                        {visibleColumns.closers && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-2 text-left"
                            >
                                <div className="flex items-center gap-1.5 opacity-80">
                                    <UserIcon className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">
                                        Closers
                                    </span>
                                </div>
                            </div>
                        )}
                        {visibleColumns.etape && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-4 text-center text-xs font-medium text-muted-foreground"
                            >
                                Étape
                            </div>
                        )}
                        {visibleColumns.budget && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-3 text-xs font-medium text-muted-foreground"
                            >
                                Budget
                            </div>
                        )}
                        {visibleColumns.experience && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-3"
                            >
                                <div className="flex items-center gap-1.5 opacity-80">
                                    <GraduationCap className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">
                                        Expérience
                                    </span>
                                </div>
                            </div>
                        )}
                        {visibleColumns.activite && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-3 text-xs font-medium text-muted-foreground"
                            >
                                Activité
                            </div>
                        )}
                        {visibleColumns.contact && (
                            <div
                                role="columnheader"
                                className="px-3 text-xs font-medium text-muted-foreground"
                            >
                                Contact
                            </div>
                        )}
                        {visibleColumns.maj && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-3 text-xs font-medium text-muted-foreground"
                            >
                                MAJ
                            </div>
                        )}
                        {visibleColumns.timer && (
                            <div
                                role="columnheader"
                                className="whitespace-nowrap px-3 text-right pr-4"
                            >
                                <div className="flex items-center justify-end gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Timer
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        {clients.length === 0 ? (
                            <EmptyState
                                size="sm"
                                variant="search"
                                icon={Users}
                                title="Aucun client trouvé"
                                className="h-32"
                            />
                        ) : (
                            <List
                                rowCount={clients.length}
                                rowHeight={ROW_HEIGHT}
                                rowComponent={Row}
                                rowProps={rowProps}
                                onRowsRendered={handleRowsRendered}
                                overscanCount={6}
                                style={{ height: "100%", width: "100%" }}
                                className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            />
                        )}
                    </div>
                </div>
            </div>

            {hasMoreClients && (
                <div className="flex justify-center py-3 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={isLoadingMoreClients}
                        className="rounded-full px-6 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors duration-base gap-2"
                    >
                        {isLoadingMoreClients
                            ? "Chargement…"
                            : `Charger plus (${clients.length})`}
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    )
})
