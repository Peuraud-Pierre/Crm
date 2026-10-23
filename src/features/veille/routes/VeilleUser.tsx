import { useMemo, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { LoadingScreen } from "@/shared/ui/atoms/loading-screen"
import { useVeilleReports } from "../hooks/useVeilleReports"
import { VeilleCardAuto } from "../components/VeilleCardAuto"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    AlertCircle,
    TrendingUp,
    RefreshCw,
    Loader2,
    Filter,
    BookMarked,
    Search,
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export default function VeilleUser() {
    const { user } = useAuth()
    const { reports, loading, error, refetch } = useVeilleReports({
        userServiceId: user?.service_id,
    })
    const [frequencyFilter, setFrequencyFilter] = useState<string>("all")
    const [importanceFilter, setImportanceFilter] = useState<string>("all")
    const [dateRange, setDateRange] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")

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

            return matchesFrequency && matchesImportance && matchesSearch && matchesDateRange
        })
    }, [reports, frequencyFilter, importanceFilter, searchQuery, dateRange])

    const stats = useMemo(() => {
        const sorted = [...filteredReports].sort(
            (a, b) => (b.importance_score || 0) - (a.importance_score || 0)
        )
        return {
            total: filteredReports.length,
            critical: filteredReports.filter(
                (r) => r.importance_score !== null && r.importance_score >= 4
            ).length,
            featured: sorted.slice(0, 3),
        }
    }, [filteredReports])

    const hasActiveFilters =
        frequencyFilter !== "all" ||
        importanceFilter !== "all" ||
        dateRange !== "all" ||
        searchQuery !== ""

    const resetFilters = () => {
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

    return (
        <div className="flex-1 flex flex-col">
            {/* Sticky header area */}
            <div className="p-4 md:p-6 pb-4 space-y-4 md:space-y-6">
                <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                    {/* Welcome Section */}
                    <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-primary/5 p-4 md:p-6 space-y-2">
                        <div className="flex items-center gap-2">
                            <BookMarked className="h-5 w-5 text-primary shrink-0" />
                            <h1 className="text-2xl md:text-3xl font-bold">Votre veille strategique</h1>
                        </div>
                        <p className="text-sm md:text-base text-muted-foreground">
                            Restez informe des actualites importantes pour votre domaine d'activite
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="p-3 md:p-4 rounded-lg border bg-card">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">
                                        Rapports disponibles
                                    </p>
                                    <p className="text-2xl md:text-3xl font-bold mt-1">
                                        {stats.total}
                                    </p>
                                </div>
                                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-primary/40 shrink-0" />
                            </div>
                        </div>
                        <div className="p-3 md:p-4 rounded-lg border bg-card">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">
                                        Sujets critiques
                                    </p>
                                    <p className="text-2xl md:text-3xl font-bold mt-1 text-red-600">
                                        {stats.critical}
                                    </p>
                                </div>
                                <AlertCircle className="h-6 w-6 md:h-8 md:w-8 text-red-500/40 shrink-0" />
                            </div>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Rechercher dans les rapports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Filters & Actions */}
                    <div className="rounded-lg border bg-card p-3 md:p-4 space-y-3 md:space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium">Filtres:</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Select
                                    value={frequencyFilter}
                                    onValueChange={setFrequencyFilter}
                                >
                                    <SelectTrigger className="w-full sm:w-[150px]">
                                        <SelectValue placeholder="Frequence" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes</SelectItem>
                                        <SelectItem value="daily">Quotidien</SelectItem>
                                        <SelectItem value="weekly">
                                            Hebdomadaire
                                        </SelectItem>
                                        <SelectItem value="monthly">
                                            Mensuel
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={importanceFilter}
                                    onValueChange={setImportanceFilter}
                                >
                                    <SelectTrigger className="w-full sm:w-[150px]">
                                        <SelectValue placeholder="Importance" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes</SelectItem>
                                        <SelectItem value="high">
                                            Critique (4-5)
                                        </SelectItem>
                                        <SelectItem value="medium">
                                            Important (3)
                                        </SelectItem>
                                        <SelectItem value="low">Normal (1-2)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={dateRange}
                                    onValueChange={setDateRange}
                                >
                                    <SelectTrigger className="w-full sm:w-[130px]">
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
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="w-full sm:w-auto"
                                    >
                                        Reinitialiser
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Button
                            onClick={() => refetch()}
                            disabled={loading}
                            variant="outline"
                            className="w-full gap-2"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                            />
                            Actualiser
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content area */}
            <main className="p-4 md:p-6 pt-4 md:pt-6">
                <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                    {/* Featured Reports */}
                    {stats.featured.length > 0 && !searchQuery && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="rounded-full">
                                    A la une
                                </Badge>
                                <p className="text-sm text-muted-foreground">
                                    Les sujets les plus importants
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {stats.featured.map((report) => (
                                    <div
                                        key={report.id}
                                        className="p-3 md:p-4 rounded-lg border bg-card hover:shadow-md transition cursor-pointer min-w-0"
                                    >
                                        <div className="flex items-start justify-between mb-2 gap-2">
                                            <Badge
                                                variant={
                                                    report.importance_score! >= 4
                                                        ? "destructive"
                                                        : "secondary"
                                                }
                                                className="text-xs shrink-0"
                                            >
                                                {report.importance_score}/5
                                            </Badge>
                                            <Badge variant="outline" className="text-xs shrink-0">
                                                {report.frequency}
                                            </Badge>
                                        </div>
                                        <p className="font-medium text-sm line-clamp-2">
                                            {report.title || report.topic}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {new Date(report.created_at).toLocaleDateString("fr-FR")}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <p className="text-muted-foreground">
                                    Chargement des rapports...
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 md:p-6 rounded-lg border border-destructive bg-destructive/10">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p className="font-semibold">Erreur de chargement</p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                {error.message}
                            </p>
                            <Button
                                onClick={() => refetch()}
                                variant="outline"
                                size="sm"
                                className="mt-4"
                            >
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
                                    ? "Les rapports de veille apparaîtront ici."
                                    : "Aucun rapport ne correspond aux filtres sélectionnés."
                            }
                        />
                    )}

                    {!loading && !error && filteredReports.length > 0 && (
                        <div className="space-y-4 md:space-y-6">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg md:text-xl font-semibold">
                                    Tous les rapports
                                </h2>
                                <Badge variant="outline">
                                    {filteredReports.length}
                                </Badge>
                            </div>
                            {filteredReports.map((report) => (
                                <VeilleCardAuto key={report.id} item={report} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
