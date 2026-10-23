import { useState, useMemo } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { LoadingScreen } from "@/shared/ui/atoms/loading-screen"
import { useVeilleReports } from "../hooks/useVeilleReports"
import { useTopics, type WatchConfig } from "../hooks/useTopics"
import { VeilleCardAuto } from "../components/VeilleCardAuto"
import { TopicSelector } from "../components/TopicSelector"
import { WorkflowResults } from "../components/WorkflowResults"
import { useN8nWorkflow, N8N_WORKFLOW_ID } from "../hooks/useN8nWorkflow"
import { ConfigServicesModal } from "../components/ConfigServicesModal"
import { Unauthorized } from "@/shared/components/misc/Unauthorized"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { Input } from "@/shared/ui/atoms/input"
import {
    AlertCircle,
    Trash2,
    Settings,
    RefreshCw,
    Loader2,
    Zap,
    Play,
    FileText,
    RotateCcw,
    Search,
    SearchX,
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { deleteReport } from "../services/veilleReportService"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export default function VeilleAdmin() {
    const { user, hasPermission } = useAuth()
    const { reports, loading, error, refetch } = useVeilleReports({
        fetchAll: true,
    })
    const { configs, updateConfigServices } = useTopics()
    const {
        executing,
        lastExecution,
        error: execError,
        execute,
        clearError,
        fetchLatest,
    } = useN8nWorkflow()
    const [selectedTopic, setSelectedTopic] = useState<string>("all")
    const [frequencyFilter, setFrequencyFilter] = useState<string>("all")
    const [importanceFilter, setImportanceFilter] = useState<string>("all")
    const [dateRange, setDateRange] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [selectedConfig, setSelectedConfig] = useState<
        WatchConfig | undefined
    >()
    const [servicesModalConfig, setServicesModalConfig] = useState<{
        id: number
        name: string
        currentServiceIds: string[] | null
    } | null>(null)

    const filteredReports = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()
        return reports.filter((report) => {
            const matchesTopic =
                selectedTopic === "all" || report.topic === selectedTopic
            const matchesFrequency =
                frequencyFilter === "all" ||
                report.frequency === frequencyFilter
            const matchesImportance =
                importanceFilter === "all" ||
                (importanceFilter === "high" &&
                    report.importance_score !== null &&
                    report.importance_score >= 4) ||
                (importanceFilter === "medium" &&
                    report.importance_score === 3) ||
                (importanceFilter === "low" &&
                    report.importance_score !== null &&
                    report.importance_score < 3)
            const matchesSearch =
                !query ||
                report.topic?.toLowerCase().includes(query) ||
                report.title?.toLowerCase().includes(query) ||
                report.executive_summary?.toLowerCase().includes(query) ||
                report.recommended_actions?.toLowerCase().includes(query) ||
                report.tags?.some((t) => t.toLowerCase().includes(query))
            const matchesDateRange = (() => {
                if (dateRange === "all") return true
                const now = new Date()
                const created = new Date(report.created_at)
                switch (dateRange) {
                    case "1m":
                        return (
                            created >=
                            new Date(now.setMonth(now.getMonth() - 1))
                        )
                    case "3m":
                        return (
                            created >=
                            new Date(
                                new Date().setMonth(new Date().getMonth() - 3)
                            )
                        )
                    case "6m":
                        return (
                            created >=
                            new Date(
                                new Date().setMonth(new Date().getMonth() - 6)
                            )
                        )
                    case "1y":
                        return (
                            created >=
                            new Date(
                                new Date().setFullYear(
                                    new Date().getFullYear() - 1
                                )
                            )
                        )
                    default:
                        return true
                }
            })()

            return (
                matchesTopic &&
                matchesFrequency &&
                matchesImportance &&
                matchesSearch &&
                matchesDateRange
            )
        })
    }, [
        reports,
        selectedTopic,
        frequencyFilter,
        importanceFilter,
        searchQuery,
        dateRange,
    ])

    const stats = useMemo(() => {
        return {
            totalReports: reports.length,
            avgImportance:
                reports.length > 0
                    ? (
                          reports.reduce(
                              (sum, r) => sum + (r.importance_score || 0),
                              0
                          ) / reports.length
                      ).toFixed(1)
                    : "0",
            critical: reports.filter(
                (r) => r.importance_score !== null && r.importance_score >= 4
            ).length,
        }
    }, [reports])

    const handleDeleteReport = async (id: string) => {
        if (!confirm("Supprimer ce rapport ?")) return

        try {
            setDeletingId(id)
            await deleteReport(id)
            await refetch()
        } catch (err) {
            alert(
                "Erreur lors de la suppression: " +
                    (err instanceof Error
                        ? err.message
                        : typeof err === "object" &&
                            err !== null &&
                            "message" in err
                          ? String((err as { message: unknown }).message)
                          : "Erreur inconnue")
            )
        } finally {
            setDeletingId(null)
        }
    }

    const hasActiveFilters =
        selectedTopic !== "all" ||
        frequencyFilter !== "all" ||
        importanceFilter !== "all" ||
        dateRange !== "all" ||
        searchQuery !== ""

    const resetFilters = () => {
        setSelectedTopic("all")
        setFrequencyFilter("all")
        setImportanceFilter("all")
        setDateRange("all")
        setSearchQuery("")
    }

    if (!user) {
        return (
            <LoadingScreen className="min-h-0" />
        )
    }

    if (!hasPermission("veille.admin")) {
        return (
            <Unauthorized
                title="Acces refuse"
                description="Vous n'avez pas les permissions necessaires pour acceder a l'administration de la veille."
            />
        )
    }

    return (
        <div className="flex-1 flex flex-col max-h-screen">
            <Tabs defaultValue="rapports" className="flex-1 flex flex-col">
                {/* Sticky header area */}
                <div className="p-4 md:p-6 pb-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <Settings className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                                Administration Veille
                            </h1>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                Rapports, configurations et workflows
                            </p>
                        </div>
                    </div>

                    {/* Tabs navigation */}
                    <TabsList indicator indicatorClassName="rounded-sm" className="grid w-full grid-cols-3">
                        <TabsTrigger
                            value="rapports"
                            className="gap-1.5 text-xs sm:text-sm"
                        >
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden xs:inline">Rapports</span>
                            <span className="xs:hidden">Rapp.</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="configurations"
                            className="gap-1.5 text-xs sm:text-sm"
                        >
                            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden xs:inline">
                                Configurations
                            </span>
                            <span className="xs:hidden">Config.</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="executer"
                            className="gap-1.5 text-xs sm:text-sm"
                        >
                            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Executer</span>
                            <span className="sm:hidden">Exec.</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Content area */}
                <div className="p-4 md:p-6 pt-4">
                    <div className="max-w-5xl mx-auto">
                        {/* Tab 1: Rapports */}
                        <TabsContent
                            value="rapports"
                            className="mt-0 space-y-4"
                        >
                            {/* Stats bar */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-3 sm:px-4 py-3 rounded-lg border bg-muted/30 text-sm">
                                <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                            Total
                                        </span>
                                        <span className="font-semibold">
                                            {stats.totalReports}
                                        </span>
                                    </div>
                                    <div className="hidden sm:block h-4 w-px bg-border" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                            Critiques
                                        </span>
                                        <span className="font-semibold text-red-600">
                                            {stats.critical}
                                        </span>
                                    </div>
                                    <div className="hidden sm:block h-4 w-px bg-border" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                            Importance moy.
                                        </span>
                                        <span className="font-semibold">
                                            {stats.avgImportance}/5
                                        </span>
                                    </div>
                                </div>
                                <div className="sm:ml-auto">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => refetch()}
                                        disabled={loading}
                                        className="gap-2"
                                    >
                                        <RefreshCw
                                            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                                        />
                                        Actualiser
                                    </Button>
                                </div>
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Rechercher dans les rapports..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="pl-9 h-9"
                                />
                            </div>

                            {/* Filters row */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-wrap">
                                <div className="w-full sm:w-auto sm:min-w-[180px]">
                                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                                        Configuration
                                    </label>
                                    <Select
                                        value={selectedTopic}
                                        onValueChange={setSelectedTopic}
                                    >
                                        <SelectTrigger className="h-9 w-full">
                                            <SelectValue placeholder="Toutes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Toutes
                                            </SelectItem>
                                            {configs.map((config) => (
                                                <SelectItem
                                                    key={config.id}
                                                    value={config.topic}
                                                >
                                                    {config.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:w-auto sm:min-w-[160px]">
                                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                                        Frequence
                                    </label>
                                    <Select
                                        value={frequencyFilter}
                                        onValueChange={setFrequencyFilter}
                                    >
                                        <SelectTrigger className="h-9 w-full">
                                            <SelectValue placeholder="Toutes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Toutes
                                            </SelectItem>
                                            <SelectItem value="daily">
                                                Quotidien
                                            </SelectItem>
                                            <SelectItem value="weekly">
                                                Hebdomadaire
                                            </SelectItem>
                                            <SelectItem value="monthly">
                                                Mensuel
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:w-auto sm:min-w-[160px]">
                                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                                        Importance
                                    </label>
                                    <Select
                                        value={importanceFilter}
                                        onValueChange={setImportanceFilter}
                                    >
                                        <SelectTrigger className="h-9 w-full">
                                            <SelectValue placeholder="Toutes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Toutes
                                            </SelectItem>
                                            <SelectItem value="high">
                                                Critique (4-5)
                                            </SelectItem>
                                            <SelectItem value="medium">
                                                Important (3)
                                            </SelectItem>
                                            <SelectItem value="low">
                                                Normal (1-2)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:w-auto sm:min-w-[160px]">
                                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                                        Periode
                                    </label>
                                    <Select
                                        value={dateRange}
                                        onValueChange={setDateRange}
                                    >
                                        <SelectTrigger className="h-9 w-full">
                                            <SelectValue placeholder="Toutes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Toutes
                                            </SelectItem>
                                            <SelectItem value="1m">
                                                1 mois
                                            </SelectItem>
                                            <SelectItem value="3m">
                                                3 mois
                                            </SelectItem>
                                            <SelectItem value="6m">
                                                6 mois
                                            </SelectItem>
                                            <SelectItem value="1y">
                                                1 an
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="gap-1.5 text-muted-foreground h-9 w-full sm:w-auto"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Reinitialiser
                                    </Button>
                                )}
                            </div>

                            {/* Reports list */}
                            {loading && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}

                            {error && (
                                <div className="p-4 rounded-lg border border-destructive bg-destructive/10">
                                    <div className="flex items-center gap-2 text-destructive">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <p className="text-sm font-medium break-words min-w-0">
                                            Erreur: {error.message}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!loading &&
                                !error &&
                                filteredReports.length === 0 && (
                                    <EmptyState
                                        icon={SearchX}
                                        variant="search"
                                        title="Aucun rapport"
                                        description="Aucun rapport ne correspond aux filtres."
                                    />
                                )}

                            {!loading &&
                                !error &&
                                filteredReports.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-muted-foreground">
                                            {filteredReports.length} rapport
                                            {filteredReports.length > 1
                                                ? "s"
                                                : ""}
                                            {hasActiveFilters
                                                ? " (filtre actif)"
                                                : ""}
                                        </p>
                                        {filteredReports.map((report) => (
                                            <div
                                                key={report.id}
                                                className="group relative rounded-lg border p-3 sm:p-4 hover:bg-muted/50 transition overflow-hidden"
                                            >
                                                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={
                                                            deletingId ===
                                                            report.id
                                                        }
                                                        onClick={() =>
                                                            handleDeleteReport(
                                                                report.id
                                                            )
                                                        }
                                                        loading={
                                                            deletingId ===
                                                            report.id
                                                        }
                                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                    >
                                                        {deletingId !==
                                                            report.id && (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <VeilleCardAuto item={report} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </TabsContent>

                        {/* Tab 2: Configurations */}
                        <TabsContent
                            value="configurations"
                            className="mt-0 space-y-6"
                        >
                            <div className="rounded-lg border bg-card p-4 md:p-6 space-y-4">
                                <div>
                                    <h2 className="font-semibold">
                                        Configurations de veille
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Creer, modifier ou selectionner les
                                        configurations
                                    </p>
                                </div>
                                <TopicSelector
                                    selectedConfig={selectedConfig}
                                    onConfigSelect={setSelectedConfig}
                                />
                            </div>

                            {/* Configs with service assignments */}
                            {configs.length > 0 && (
                                <div className="rounded-lg border bg-card p-4 md:p-6 space-y-4">
                                    <div>
                                        <h2 className="font-semibold">
                                            Services par configuration
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Associer des services a chaque
                                            configuration de veille
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        {configs.map((config) => (
                                            <div
                                                key={config.id}
                                                className="flex items-center justify-between p-3 rounded-lg border border-muted bg-muted/30 hover:bg-muted/50 transition gap-2"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {config.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {config.service_ids &&
                                                        config.service_ids
                                                            .length > 0
                                                            ? `${config.service_ids.length} service(s)`
                                                            : "Tous les services"}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0 gap-1.5"
                                                    onClick={() =>
                                                        setServicesModalConfig({
                                                            id: config.id,
                                                            name: config.name,
                                                            currentServiceIds:
                                                                config.service_ids ??
                                                                null,
                                                        })
                                                    }
                                                >
                                                    <Zap className="h-3 w-3" />
                                                    <span className="hidden sm:inline">
                                                        Services
                                                    </span>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Tab 3: Executer */}
                        <TabsContent
                            value="executer"
                            className="mt-0 space-y-4"
                        >
                            <div className="rounded-lg border bg-card p-4 md:p-6 space-y-4">
                                <div>
                                    <h3 className="font-semibold">
                                        Veille RH Hebdo via OpenRouter
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Lancer le workflow sur la configuration
                                        selectionnee
                                    </p>
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <Badge
                                            variant="outline"
                                            className="font-mono text-xs"
                                        >
                                            {N8N_WORKFLOW_ID}
                                        </Badge>
                                        <Badge variant="secondary">
                                            Active
                                        </Badge>
                                    </div>
                                </div>

                                {!selectedConfig ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm rounded-lg border border-dashed">
                                        <Settings className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        <p>
                                            Selectionnez une configuration dans
                                            l'onglet Configurations
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Selected config summary */}
                                        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                                            <p className="text-sm font-medium">
                                                {selectedConfig.name}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline">
                                                    {selectedConfig.topic}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {selectedConfig.language}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {selectedConfig.horizon}
                                                </Badge>
                                                {selectedConfig.persona && (
                                                    <Badge variant="secondary">
                                                        {selectedConfig.persona}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                                            <Button
                                                onClick={async () => {
                                                    if (selectedConfig)
                                                        await fetchLatest(
                                                            selectedConfig.topic
                                                        )
                                                }}
                                                variant="outline"
                                                size="sm"
                                                disabled={executing}
                                                className="gap-2 w-full sm:w-auto"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Rafraichir dernier rapport
                                            </Button>
                                            <Button
                                                onClick={async () => {
                                                    if (selectedConfig) {
                                                        await execute(
                                                            selectedConfig
                                                        )
                                                        refetch()
                                                    }
                                                }}
                                                loading={executing}
                                                className="gap-2 w-full sm:w-auto"
                                            >
                                                {executing ? (
                                                    "Exécution…"
                                                ) : (
                                                    <>
                                                        <Play className="h-4 w-4" />
                                                        Exécuter
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </>
                                )}

                                {execError && (
                                    <div className="p-3 rounded-lg border border-destructive bg-destructive/10">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-destructive">
                                                    Erreur
                                                </p>
                                                <p className="text-xs text-destructive/80 mt-1 break-words">
                                                    {execError.message}
                                                </p>
                                            </div>
                                            <button
                                                onClick={clearError}
                                                className="text-destructive/80 hover:text-destructive text-xs font-medium"
                                            >
                                                X
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {lastExecution && !execError && (
                                    <WorkflowResults
                                        data={lastExecution.data}
                                        status={lastExecution.status}
                                        timestamp={lastExecution.startTime}
                                    />
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </div>

                {/* Services Modal */}
                {servicesModalConfig && (
                    <ConfigServicesModal
                        configId={servicesModalConfig.id}
                        configName={servicesModalConfig.name}
                        currentServiceIds={
                            servicesModalConfig.currentServiceIds
                        }
                        isOpen={!!servicesModalConfig}
                        onClose={() => setServicesModalConfig(null)}
                        onSave={updateConfigServices}
                    />
                )}
            </Tabs>
        </div>
    )
}
