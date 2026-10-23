import { useMemo, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { LoadingScreen } from "@/shared/ui/atoms/loading-screen"
import { useVeilleReports } from "../hooks/useVeilleReports"
import { useTopics, type WatchConfig } from "../hooks/useTopics"
import { useN8nWorkflow } from "../hooks/useN8nWorkflow"
import { VeilleCardAuto } from "../components/VeilleCardAuto"
import { WorkflowResults } from "../components/WorkflowResults"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    AlertCircle,
    TrendingUp,
    Filter,
    RefreshCw,
    Loader2,
    Search,
    Plus,
    X,
    Play,
    Zap,
    Pencil,
    Trash2,
    Check,
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export default function Veille() {
    const { user } = useAuth()
    const { reports, loading, error, refetch } = useVeilleReports({
        userServiceId: user?.service_id,
    })
    const { configs, createConfig, updateConfig, deleteConfig } = useTopics({ userServiceId: user?.service_id })
    const {
        executing,
        lastExecution,
        error: execError,
        execute,
        clearError,
        clearLastExecution,
    } = useN8nWorkflow()

    const [frequencyFilter, setFrequencyFilter] = useState<string>("all")
    const [importanceFilter, setImportanceFilter] = useState<string>("all")
    const [topicFilter, setTopicFilter] = useState<string>("all")
    const [dateRange, setDateRange] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [showFilters, setShowFilters] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [executingConfigId, setExecutingConfigId] = useState<number | null>(null)
    const [creating, setCreating] = useState(false)
    const [editingConfig, setEditingConfig] = useState<WatchConfig | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [newConfig, setNewConfig] = useState({
        name: "",
        topic: "",
        language: "francais",
        horizon: "7 derniers jours",
        persona: "",
        active: true,
    })

    const filteredReports = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()
        return reports.filter((report) => {
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
            const matchesTopic =
                topicFilter === "all" || report.topic === topicFilter
            const matchesSearch =
                !query ||
                report.topic?.toLowerCase().includes(query) ||
                report.title?.toLowerCase().includes(query) ||
                report.executive_summary?.toLowerCase().includes(query) ||
                report.recommended_actions?.toLowerCase().includes(query) ||
                report.tags?.some((t) => t.toLowerCase().includes(query))
            const matchesDateRange = (() => {
                if (dateRange === "all") return true
                const created = new Date(report.created_at)
                switch (dateRange) {
                    case "1m": return created >= new Date(new Date().setMonth(new Date().getMonth() - 1))
                    case "3m": return created >= new Date(new Date().setMonth(new Date().getMonth() - 3))
                    case "6m": return created >= new Date(new Date().setMonth(new Date().getMonth() - 6))
                    case "1y": return created >= new Date(new Date().setFullYear(new Date().getFullYear() - 1))
                    default: return true
                }
            })()

            return matchesFrequency && matchesImportance && matchesTopic && matchesSearch && matchesDateRange
        })
    }, [reports, frequencyFilter, importanceFilter, topicFilter, searchQuery, dateRange])

    const stats = useMemo(() => {
        return {
            total: reports.length,
            weekly: reports.filter((r) => r.frequency === "weekly").length,
            monthly: reports.filter((r) => r.frequency === "monthly").length,
            critical: reports.filter(
                (r) => r.importance_score !== null && r.importance_score >= 4
            ).length,
        }
    }, [reports])

    const hasActiveFilters =
        frequencyFilter !== "all" ||
        importanceFilter !== "all" ||
        topicFilter !== "all" ||
        dateRange !== "all"

    const resetFilters = () => {
        setFrequencyFilter("all")
        setImportanceFilter("all")
        setTopicFilter("all")
        setDateRange("all")
    }

    const handleExecuteConfig = async (config: WatchConfig) => {
        setExecutingConfigId(config.id)
        await execute(config)
        refetch()
        setExecutingConfigId(null)
    }

    const handleCreateConfig = async () => {
        if (!newConfig.name.trim() || !newConfig.topic.trim() || !newConfig.persona.trim())
            return
        try {
            setCreating(true)
            const config = await createConfig(
                newConfig,
                user?.service_id ? [user.service_id] : undefined
            )
            if (config) {
                setNewConfig({
                    name: "",
                    topic: "",
                    language: "francais",
                    horizon: "7 derniers jours",
                    persona: "",
                    active: true,
                })
                setShowCreateForm(false)
            }
        } finally {
            setCreating(false)
        }
    }

    const handleUpdateConfig = async () => {
        if (!editingConfig) return
        try {
            await updateConfig(editingConfig.id, {
                name: editingConfig.name,
                topic: editingConfig.topic,
                language: editingConfig.language,
                horizon: editingConfig.horizon,
                persona: editingConfig.persona,
            })
            setEditingConfig(null)
        } catch {
            // error handled by hook
        }
    }

    const handleDeleteConfig = async (id: number) => {
        setDeletingId(id)
        await deleteConfig(id)
        setDeletingId(null)
    }

    if (!user) {
        return (
            <LoadingScreen className="min-h-0" />
        )
    }

    return (
        <div className="flex-1 flex flex-col">
            <div className="p-4 md:p-6 pb-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Veille strategique
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Suivez et lancez vos veilles en direct
                        </p>
                    </div>
                    <Button
                        onClick={() => refetch()}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                </div>

                {/* Configs cards - lancer en direct */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold">Lancer une veille</h3>
                        </div>
                        <Button
                            variant={showCreateForm ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="gap-1.5 text-xs"
                        >
                            {showCreateForm ? (
                                <><X className="h-3.5 w-3.5" /> Annuler</>
                            ) : (
                                <><Plus className="h-3.5 w-3.5" /> Nouvelle veille</>
                            )}
                        </Button>
                    </div>

                    {/* Create form */}
                    {showCreateForm && (
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Nom *</label>
                                    <Input
                                        placeholder="ex: Veille IA"
                                        value={newConfig.name}
                                        onChange={(e) => setNewConfig((p) => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Sujet *</label>
                                    <Input
                                        placeholder="ex: intelligence artificielle, LLMs"
                                        value={newConfig.topic}
                                        onChange={(e) => setNewConfig((p) => ({ ...p, topic: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Langue</label>
                                    <Select value={newConfig.language} onValueChange={(v) => setNewConfig((p) => ({ ...p, language: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="francais">Francais</SelectItem>
                                            <SelectItem value="anglais">Anglais</SelectItem>
                                            <SelectItem value="tous">Tous</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Horizon</label>
                                    <Select value={newConfig.horizon} onValueChange={(v) => setNewConfig((p) => ({ ...p, horizon: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="7 derniers jours">7 jours</SelectItem>
                                            <SelectItem value="15 derniers jours">15 jours</SelectItem>
                                            <SelectItem value="30 derniers jours">30 jours</SelectItem>
                                            <SelectItem value="3 derniers mois">3 mois</SelectItem>
                                            <SelectItem value="6 derniers mois">6 mois</SelectItem>
                                            <SelectItem value="1 an">1 an</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1 block text-muted-foreground">Persona / contexte *</label>
                                <textarea
                                    placeholder="ex: expert en droit du travail pour une collectivite territoriale"
                                    value={newConfig.persona}
                                    onChange={(e) => setNewConfig((p) => ({ ...p, persona: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
                                    rows={2}
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={handleCreateConfig}
                                disabled={!newConfig.name.trim() || !newConfig.topic.trim() || !newConfig.persona.trim()}
                                loading={creating}
                                className="gap-2"
                            >
                                {creating ? (
                                    "Création…"
                                ) : (
                                    <><Plus className="h-4 w-4" /> Créer la veille</>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Configs list */}
                    {configs.length === 0 && !showCreateForm && (
                        <EmptyState
                            icon={Zap}
                            size="sm"
                            title="Aucune veille configurée"
                            description="Cliquez sur « Nouvelle veille » pour commencer."
                            className="rounded-lg border border-dashed"
                        />
                    )}

                    {configs.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {configs.map((config) => {
                                const isExecuting = executing && executingConfigId === config.id
                                const isEditing = editingConfig?.id === config.id
                                const isDeleting = deletingId === config.id

                                if (isEditing) {
                                    return (
                                        <div key={config.id} className="rounded-lg border border-primary/40 bg-card p-3 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Nom</label>
                                                    <Input
                                                        value={editingConfig.name}
                                                        onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Sujet</label>
                                                    <Input
                                                        value={editingConfig.topic}
                                                        onChange={(e) => setEditingConfig({ ...editingConfig, topic: e.target.value })}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Langue</label>
                                                    <Select value={editingConfig.language} onValueChange={(v) => setEditingConfig({ ...editingConfig, language: v })}>
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="francais">Francais</SelectItem>
                                                            <SelectItem value="anglais">Anglais</SelectItem>
                                                            <SelectItem value="tous">Tous</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Horizon</label>
                                                    <Select value={editingConfig.horizon} onValueChange={(v) => setEditingConfig({ ...editingConfig, horizon: v })}>
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="7 derniers jours">7 jours</SelectItem>
                                                            <SelectItem value="15 derniers jours">15 jours</SelectItem>
                                                            <SelectItem value="30 derniers jours">30 jours</SelectItem>
                                                            <SelectItem value="3 derniers mois">3 mois</SelectItem>
                                                            <SelectItem value="6 derniers mois">6 mois</SelectItem>
                                                            <SelectItem value="1 an">1 an</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-medium text-muted-foreground">Persona</label>
                                                <textarea
                                                    value={editingConfig.persona}
                                                    onChange={(e) => setEditingConfig({ ...editingConfig, persona: e.target.value })}
                                                    className="w-full px-2 py-1.5 rounded border bg-background text-xs resize-none"
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" className="flex-1 gap-1.5 h-7 text-xs" onClick={handleUpdateConfig}>
                                                    <Check className="h-3 w-3" /> Enregistrer
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingConfig(null)}>
                                                    Annuler
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <div
                                        key={config.id}
                                        className="rounded-lg border bg-card p-3 flex flex-col gap-2 hover:shadow-sm transition"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-sm truncate">{config.name}</p>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">{config.topic}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {config.horizon}
                                                </Badge>
                                                <button
                                                    onClick={() => setEditingConfig(config)}
                                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteConfig(config.id)}
                                                    disabled={isDeleting}
                                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                    title="Supprimer"
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3 w-3" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        {config.persona && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">{config.persona}</p>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="default"
                                            className="w-full gap-2 mt-auto"
                                            disabled={executing}
                                            loading={isExecuting}
                                            onClick={() => handleExecuteConfig(config)}
                                        >
                                            {isExecuting ? (
                                                "Exécution…"
                                            ) : (
                                                <><Play className="h-3.5 w-3.5" /> Lancer</>
                                            )}
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Execution result */}
                    {execError && (
                        <div className="p-3 rounded-lg border border-destructive bg-destructive/10">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-destructive">Erreur d'execution</p>
                                    <p className="text-xs text-destructive/80 mt-1 break-words">{execError.message}</p>
                                </div>
                                <button onClick={clearError} className="text-destructive/80 hover:text-destructive text-xs font-medium shrink-0">
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
                            onDismiss={clearLastExecution}
                        />
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border bg-card text-center">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-xl font-bold mt-1">{stats.total}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-card text-center">
                        <p className="text-xs text-muted-foreground">Hebdo</p>
                        <p className="text-xl font-bold mt-1">{stats.weekly}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-card text-center">
                        <p className="text-xs text-muted-foreground">Mensuel</p>
                        <p className="text-xl font-bold mt-1">{stats.monthly}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-card text-center">
                        <p className="text-xs text-muted-foreground">Critique</p>
                        <p className="text-xl font-bold mt-1 text-red-600">{stats.critical}</p>
                    </div>
                </div>

                {/* Search + filters */}
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Rechercher dans les rapports..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant={showFilters || hasActiveFilters ? "secondary" : "outline"}
                            size="icon"
                            onClick={() => setShowFilters(!showFilters)}
                            className="shrink-0 relative"
                        >
                            <Filter className="h-4 w-4" />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                            )}
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap rounded-lg border bg-card p-3">
                            <Select value={topicFilter} onValueChange={setTopicFilter}>
                                <SelectTrigger className="w-full sm:w-[170px] h-8 text-xs">
                                    <SelectValue placeholder="Configuration" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes configs</SelectItem>
                                    {configs.map((c) => (
                                        <SelectItem key={c.id} value={c.topic}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                                    <SelectValue placeholder="Frequence" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes freq.</SelectItem>
                                    <SelectItem value="daily">Quotidien</SelectItem>
                                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                                    <SelectItem value="monthly">Mensuel</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={importanceFilter} onValueChange={setImportanceFilter}>
                                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                                    <SelectValue placeholder="Importance" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes</SelectItem>
                                    <SelectItem value="high">Critique (4-5)</SelectItem>
                                    <SelectItem value="medium">Important (3)</SelectItem>
                                    <SelectItem value="low">Normal (1-2)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={dateRange} onValueChange={setDateRange}>
                                <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
                                    <SelectValue placeholder="Periode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes</SelectItem>
                                    <SelectItem value="1m">1 mois</SelectItem>
                                    <SelectItem value="3m">3 mois</SelectItem>
                                    <SelectItem value="6m">6 mois</SelectItem>
                                    <SelectItem value="1y">1 an</SelectItem>
                                </SelectContent>
                            </Select>
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs h-8">
                                    Reinitialiser
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Reports */}
            <div className="p-4 md:p-6 pt-0">
                <div className="space-y-4">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <p className="text-muted-foreground">Chargement des rapports...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-lg border border-destructive bg-destructive/10">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p className="font-semibold">Erreur de chargement</p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
                            <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
                                Reessayer
                            </Button>
                        </div>
                    )}

                    {!loading && !error && filteredReports.length === 0 && (
                        <EmptyState
                            icon={TrendingUp}
                            variant={reports.length === 0 ? "default" : "search"}
                            title="Aucun rapport disponible"
                            description={
                                reports.length === 0
                                    ? "Lancez une veille pour générer votre premier rapport."
                                    : "Aucun rapport ne correspond aux filtres."
                            }
                        />
                    )}

                    {!loading && !error && filteredReports.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                {filteredReports.length} rapport{filteredReports.length > 1 ? "s" : ""}
                                {hasActiveFilters || searchQuery ? " (filtre actif)" : ""}
                            </p>
                            {filteredReports.map((report) => (
                                <VeilleCardAuto key={report.id} item={report} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
