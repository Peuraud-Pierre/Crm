import React, { memo, useEffect, useRef } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useCustomers } from "../../context/CustomerContext"
import { useClientsExport } from "../../hooks/data/useClientsExport"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { cn } from "@/shared/lib/utils"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"
import { TABLE_COLUMNS_CONFIG } from "@/shared/utils/CrmTab"
import type { LucideIcon } from "lucide-react"
import {
    Calendar,
    Columns,
    Download,
    LayoutGrid,
    Loader2,
    ListTodo,
    Plus,
    Search,
    Settings2,
    Table as TableIcon,
    User,
    Users,
    Wallet,
    X,
} from "lucide-react"

// Export Excel de toute la base clients — réservé aux admins (accordé au rôle
// Super Admin par la migration 20261022120000). Code inline, comme
// "crm.brief_options.manage" dans BriefOptionsTab.
const CRM_CLIENTS_EXPORT = "crm.clients.export"

// --- Petits composants utilitaires pour le filtre ---

interface SelectFilterProps {
    value: string
    onChange: (value: string) => void
    icon: LucideIcon
    iconColor?: string
    placeholder: string
    width: string
    children: React.ReactNode
}

const SelectFilter = ({
    value,
    onChange,
    icon: Icon,
    iconColor,
    placeholder,
    width,
    children,
}: SelectFilterProps) => (
    <Select value={value} onValueChange={onChange}>
        <SelectTrigger
            style={{ width }}
            className="h-9 text-xs border-dashed border-gray-300 dark:border-muted-foreground/40 bg-gray-50/50 dark:bg-transparent hover:bg-card dark:hover:bg-muted/50 hover:border-primary/50 transition-colors"
        >
            <div className="flex items-center gap-2 truncate">
                <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${iconColor || "text-primary"}`}
                />
                <SelectValue placeholder={placeholder} />
            </div>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
    </Select>
)

interface TaskButtonProps {
    id: string
    label: string
    icon?: LucideIcon
    color?: string
    current: string
    set: (id: string) => void
}

const TaskButton = ({
    id,
    label,
    icon: Icon,
    color,
    current,
    set,
}: TaskButtonProps) => (
    <button
        onClick={() => set(id)}
        className={cn(
            "px-2.5 h-full text-[10px] sm:text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5",
            current === id
                ? `bg-white dark:bg-background shadow-sm ${color || "text-foreground"} ring-1 ring-black/5 dark:ring-border`
                : "text-muted-foreground hover:text-foreground hover:bg-card/40 dark:hover:bg-muted/40"
        )}
    >
        {Icon && <Icon className="h-3 w-3" />}
        {label}
    </button>
)

// --- COMPOSANT PRINCIPAL ---
// Remarque : Plus aucune props ! Le composant se branche directement sur le context.
export const FilterBar = memo(function FilterBar() {
    const { user, hasPermission } = useAuth()
    const canExport = hasPermission(CRM_CLIENTS_EXPORT)
    const { search } = useCRMContext()

    // Conteneurs des deux bascules : ils servent d'offsetParent aux pastilles.
    const audienceRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<HTMLDivElement | null>(null)

    // Récupération de toute la logique depuis le contexte
    const {
        activeTab,
        setActiveTab,
        viewMode,
        setViewMode,
        searchTerm,
        setSearchTerm,
        filters,
        updateFilter,
        resetFilters,
        hasActiveFilters,
        visibleColumns,
        setVisibleColumns,
        handleNewLead,
    } = useCustomers()

    const { exportClients, exporting } = useClientsExport()

    const usersList = search.filter((c) => c.user_id !== user?.user_id)

    // Logique d'accueil (forcer la vue tableau)
    useEffect(() => {
        if (user?.service === "Accueil") {
            setViewMode("table")
            if (filters.user !== "all") {
                updateFilter("user", "all")
            }
        }
    }, [user, setViewMode, updateFilter, filters.user])

    return (
        <div className="flex flex-col xl:flex-row gap-3 p-2 bg-gray-50/60 dark:bg-background/50 backdrop-blur-sm border border-gray-200/60 dark:border-border rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                {/* Groupe Tabs */}
                {user?.service !== "Accueil" && (
                    <TabButtonGroup
                        containerRef={audienceRef}
                        className="flex p-1 bg-muted/50 rounded-lg border border-border/50 shrink-0"
                    >
                        <TabButton
                            id="acquisition"
                            label="Setters"
                            shortLabel="Setters"
                            icon={LayoutGrid}
                            active={activeTab}
                            set={(v) => setActiveTab(v as typeof activeTab)}
                        />
                        <TabButton
                            id="fidelisation"
                            label="Closers"
                            shortLabel="Closers"
                            icon={Users}
                            active={activeTab}
                            set={(v) => setActiveTab(v as typeof activeTab)}
                        />
                    </TabButtonGroup>
                )}

                {/* Groupe Vues */}
                <TabButtonGroup
                    containerRef={viewRef}
                    className="flex p-1 bg-muted/50 rounded-lg border border-border/50 shrink-0 gap-1"
                >
                    {/* SÉLECTEUR DE VUE : Réservé à l'Accueil */}
                    {user?.service !== "Accueil" && (
                        <>
                            <TabButton
                                id="board"
                                title="Vue Kanban"
                                icon={Columns}
                                active={viewMode}
                                set={(v) => setViewMode(v as typeof viewMode)}
                            />
                            <TabButton
                                id="table"
                                title="Vue Tableau"
                                icon={TableIcon}
                                active={viewMode}
                                set={(v) => setViewMode(v as typeof viewMode)}
                            />
                        </>
                    )}

                    {/* CONFIGURATION COLONNES : Pour tout le monde en mode tableau */}
                    {viewMode === "table" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/50 dark:hover:bg-muted transition-colors ml-1"
                                    title="Colonnes"
                                >
                                    <Settings2 className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-[150px]"
                            >
                                <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {TABLE_COLUMNS_CONFIG.map((col) => (
                                    <DropdownMenuCheckboxItem
                                        key={col.id}
                                        checked={!!visibleColumns[col.id]}
                                        onCheckedChange={(checked) => {
                                            setVisibleColumns({
                                                ...visibleColumns,
                                                [col.id]: checked,
                                            })
                                        }}
                                    >
                                        {col.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </TabButtonGroup>

                {/* Barre de recherche */}
                <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs bg-gray-100/50 dark:bg-muted/30 border-gray-200 dark:border-border focus-visible:bg-card dark:focus-visible:bg-background transition-colors"
                    />
                </div>
            </div>

            <Separator
                orientation="vertical"
                className="h-8 hidden xl:block mx-1 bg-gray-200 dark:bg-border"
            />

            <div className="flex flex-wrap items-center gap-2 flex-1">
                {user?.service !== "Accueil" && (
                    <SelectFilter
                        value={filters.user}
                        onChange={(v: string) => updateFilter("user", v)}
                        icon={User}
                        placeholder="Gestionnaire"
                        width="140px"
                    >
                        <SelectItem value="none">Mes clients</SelectItem>
                        <SelectItem value="all">Tous</SelectItem>
                        <Separator className="my-1" />
                        {usersList.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                                {u.name}
                            </SelectItem>
                        ))}
                    </SelectFilter>
                )}

                <SelectFilter
                    value={filters.date}
                    onChange={(v: string) => updateFilter("date", v)}
                    icon={Calendar}
                    placeholder="Date"
                    width="110px"
                    iconColor="text-orange-500"
                >
                    <SelectItem value="all">Tout</SelectItem>
                    <SelectItem value="1d">24h</SelectItem>
                    <SelectItem value="3d">3j</SelectItem>
                    <SelectItem value="1w">Semaine</SelectItem>
                    <SelectItem value="1m">Mois</SelectItem>
                </SelectFilter>

                <SelectFilter
                    value={filters.experience}
                    onChange={(v: string) => updateFilter("experience", v)}
                    icon={Wallet}
                    placeholder="Expérience"
                    width="110px"
                    iconColor="text-emerald-600"
                >
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="new">
                        <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4) */}
                            <span className="h-2 w-2 rounded-full bg-[#FFA500]" />
                            Nouveau
                        </div>
                    </SelectItem>
                    <SelectItem value="low">
                        <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4) */}
                            <span className="h-2 w-2 rounded-full bg-[#5c0606]" />
                            0 - 1 ans
                        </div>
                    </SelectItem>
                    <SelectItem value="mid">
                        <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4) */}
                            <span className="h-2 w-2 rounded-full bg-[#523178]" />
                            1 - 3 ans
                        </div>
                    </SelectItem>
                    <SelectItem value="high">
                        <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4) */}
                            <span className="h-2 w-2 rounded-full bg-[#084b0c]" />
                            + 3 ans
                        </div>
                    </SelectItem>
                </SelectFilter>

                {/* Groupe Tâches */}
                {user?.service !== "Accueil" && (
                    <div className="flex items-center bg-gray-200/40 dark:bg-muted/30 p-0.5 rounded-md border border-dashed border-gray-300 dark:border-muted-foreground/30 h-9">
                        <TaskButton
                            id="all"
                            label="Tous"
                            current={filters.task}
                            set={(v) => updateFilter("task", v)}
                        />
                        <Separator
                            orientation="vertical"
                            className="h-4 mx-1 bg-gray-300 dark:bg-muted-foreground/30"
                        />
                        <TaskButton
                            id="with"
                            label="Avec"
                            icon={ListTodo}
                            color="text-blue-600"
                            current={filters.task}
                            set={(v) => updateFilter("task", v)}
                        />
                        <TaskButton
                            id="without"
                            label="Sans"
                            color="text-orange-600"
                            current={filters.task}
                            set={(v) => updateFilter("task", v)}
                        />
                    </div>
                )}

                {hasActiveFilters && user?.service !== "Accueil" && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        className="h-9 px-2 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {user?.service !== "Accueil" && (
                <div className="flex items-center gap-2 shrink-0 ml-auto xl:ml-0 w-full xl:w-auto">
                    {canExport && (
                        <Button
                            variant="outline"
                            onClick={exportClients}
                            disabled={exporting}
                            title="Exporter toute la base clients (Excel)"
                            className="h-9 text-xs px-3 border-dashed whitespace-nowrap"
                        >
                            {exporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Export
                        </Button>
                    )}
                    <Button
                        onClick={handleNewLead}
                        className="w-full xl:w-auto bg-primary shadow-md hover:shadow-lg transition-shadow h-9 text-xs font-semibold px-4 whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Nouveau Lead
                    </Button>
                </div>
            )}
        </div>
    )
})
