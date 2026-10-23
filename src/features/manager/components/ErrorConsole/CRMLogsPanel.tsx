import React, { useCallback, useEffect, useMemo, useState } from "react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import {
    useLogsCRM,
    CRM_LOGS_PAGE_SIZE,
    type CRMLog,
} from "@/features/manager/hooks/Manager_hook/useLogsCRM"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { fetchClientSamplePool } from "@/features/manager/services/clientCrmService"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    ChevronDown,
    ChevronRight,
    Clock,
    Database,
    MapPin,
    Phone,
    RefreshCw,
    Search,
    Shuffle,
    User,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Échantillon clients
// ---------------------------------------------------------------------------

interface SampleClient {
    id: string
    nom: string | null
    societe: string | null
    telephone: string | null
    mail: string | null
    localisation: string | null
    collum: number | null
}

const PIPELINE_LABELS: Record<number, string> = {
    0: "Nouveau lead",
    1: "En qualification",
    2: "En incubation",
    3: "RDV Découverte",
    4: "RDV Achat",
    5: "Visio RDV",
    6: "Client Actif",
    7: "Dormant",
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function ClientSample() {
    const {
        fetchOneClient,
        openClientFiche,
        fetch_research,
        fetch_client_taches,
    } = useCRMContext()
    const [pool, setPool] = useState<SampleClient[]>([])
    const [sample, setSample] = useState<SampleClient[]>([])
    const [loading, setLoading] = useState(true)
    const [opening, setOpening] = useState<string | null>(null)

    const fetchPool = useCallback(async () => {
        setLoading(true)
        const { data } = await fetchClientSamplePool(500)
        const clients = (data ?? []) as SampleClient[]
        setPool(clients)
        setSample(shuffle(clients).slice(0, 5))
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchPool()
    }, [fetchPool])

    const resample = () => setSample(shuffle(pool).slice(0, 5))

    const handleOpen = useCallback(
        async (clientId: string) => {
            setOpening(clientId)
            // Charge en parallèle le client complet + toutes les données
            // nécessaires à la fiche (search, tâches). La liste pour la nav
            // prev/next vient du cache clients (première page chargée par useClient).
            const [client] = await Promise.all([
                fetchOneClient(clientId),
                fetch_research(),
                fetch_client_taches(clientId),
            ])
            if (client) openClientFiche(client)
            setOpening(null)
        },
        [
            fetchOneClient,
            openClientFiche,
            fetch_research,
            fetch_client_taches,
        ]
    )

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Chargement de l'échantillon…
            </div>
        )
    }

    if (sample.length === 0) return null

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                    <Shuffle className="w-3 h-3" />
                    Échantillon clients ({pool.length} total)
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={resample}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                >
                    <Shuffle className="w-3 h-3" />
                    Refaire
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                {sample.map((c, index) => {
                    const pipelineLabel = PIPELINE_LABELS[c.collum ?? 0] ?? "—"
                    const initials = (c.nom ?? "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    const isOpening = opening === c.id

                    return (
                        <button
                            key={c.id}
                            onClick={() => handleOpen(c.id)}
                            disabled={!!opening}
                            style={{
                                animationDelay: `${Math.min(index * 50, 250)}ms`,
                            }}
                            className="rounded-lg border border-border/60 bg-card p-3 flex flex-col gap-1.5 text-xs hover:border-primary/40 hover:shadow-sm hover:bg-primary/[0.02] transition-[color,background-color,border-color,box-shadow] cursor-pointer text-left disabled:opacity-60 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {isOpening ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold truncate leading-tight">
                                        {c.nom ?? "—"}
                                    </p>
                                    {c.societe && (
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {c.societe}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                {c.telephone && (
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Phone className="w-3 h-3 shrink-0" />
                                        <span className="truncate">
                                            {c.telephone}
                                        </span>
                                    </div>
                                )}
                                {c.localisation && (
                                    <div className="flex items-center gap-1.5 truncate">
                                        <MapPin className="w-3 h-3 shrink-0" />
                                        <span className="truncate">
                                            {c.localisation}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <span className="mt-auto text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground self-start">
                                {pipelineLabel}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

type DiffStatus = "added" | "removed" | "changed" | "unchanged"

interface DiffRow {
    key: string
    status: DiffStatus
    oldValue: string
    newValue: string
}

function computeDiff(
    oldRaw: string | null,
    newRaw: string | null
): DiffRow[] | null {
    let oldObj: Record<string, unknown> | null = null
    let newObj: Record<string, unknown> | null = null

    try {
        if (oldRaw) oldObj = JSON.parse(oldRaw)
    } catch {
        /* not JSON */
    }
    try {
        if (newRaw) newObj = JSON.parse(newRaw)
    } catch {
        /* not JSON */
    }

    if (oldObj === null && newObj === null) return null

    const keys = new Set([
        ...Object.keys(oldObj ?? {}),
        ...Object.keys(newObj ?? {}),
    ])

    const rows: DiffRow[] = []

    for (const key of keys) {
        const inOld = oldObj !== null && key in oldObj
        const inNew = newObj !== null && key in newObj
        const oldVal = inOld
            ? String((oldObj as Record<string, unknown>)[key] ?? "")
            : ""
        const newVal = inNew
            ? String((newObj as Record<string, unknown>)[key] ?? "")
            : ""

        if (!inOld) {
            rows.push({ key, status: "added", oldValue: "", newValue: newVal })
        } else if (!inNew) {
            rows.push({
                key,
                status: "removed",
                oldValue: oldVal,
                newValue: "",
            })
        } else if (oldVal !== newVal) {
            rows.push({
                key,
                status: "changed",
                oldValue: oldVal,
                newValue: newVal,
            })
        } else {
            rows.push({
                key,
                status: "unchanged",
                oldValue: oldVal,
                newValue: newVal,
            })
        }
    }

    return rows
}

// ---------------------------------------------------------------------------
// Diff table renderer
// ---------------------------------------------------------------------------

function DiffTable({
    old_data,
    new_data,
}: {
    old_data: string | null
    new_data: string | null
}) {
    const rows = computeDiff(old_data, new_data)

    if (rows === null) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground block mb-1">
                        Avant
                    </span>
                    <pre className="bg-muted rounded p-2 whitespace-pre-wrap break-all max-h-40 overflow-auto border border-border/40 text-destructive">
                        {old_data ?? "—"}
                    </pre>
                </div>
                <div>
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground block mb-1">
                        Après
                    </span>
                    <pre className="bg-muted rounded p-2 whitespace-pre-wrap break-all max-h-40 overflow-auto border border-border/40 text-success">
                        {new_data ?? "—"}
                    </pre>
                </div>
            </div>
        )
    }

    const hasChanges = rows.some((r) => r.status !== "unchanged")

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono border-collapse">
                <thead>
                    <tr className="border-b border-border/40">
                        <th className="text-left py-1 px-2 text-[9px] uppercase tracking-wide text-muted-foreground font-semibold w-1/4">
                            Champ
                        </th>
                        <th className="text-left py-1 px-2 text-[9px] uppercase tracking-wide text-muted-foreground font-semibold w-[37.5%]">
                            Avant
                        </th>
                        <th className="text-left py-1 px-2 text-[9px] uppercase tracking-wide text-muted-foreground font-semibold w-[37.5%]">
                            Après
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        if (row.status === "unchanged") {
                            if (hasChanges) return null
                            return (
                                <tr
                                    key={row.key}
                                    className="border-b border-border/20"
                                >
                                    <td className="py-1 px-2 text-muted-foreground/60">
                                        {row.key}
                                    </td>
                                    <td className="py-1 px-2 text-muted-foreground/60 truncate max-w-[200px]">
                                        {row.oldValue}
                                    </td>
                                    <td className="py-1 px-2 text-muted-foreground/60 truncate max-w-[200px]">
                                        {row.newValue}
                                    </td>
                                </tr>
                            )
                        }

                        if (row.status === "added") {
                            return (
                                <tr
                                    key={row.key}
                                    className="border-b border-border/20 bg-success/10"
                                >
                                    <td className="py-1 px-2 text-success font-semibold">
                                        {row.key}
                                    </td>
                                    <td className="py-1 px-2 text-muted-foreground/50">
                                        —
                                    </td>
                                    <td className="py-1 px-2 text-success break-all">
                                        {row.newValue}
                                    </td>
                                </tr>
                            )
                        }

                        if (row.status === "removed") {
                            return (
                                <tr
                                    key={row.key}
                                    className="border-b border-border/20 bg-destructive/10"
                                >
                                    <td className="py-1 px-2 text-destructive font-semibold">
                                        {row.key}
                                    </td>
                                    <td className="py-1 px-2 text-destructive line-through break-all">
                                        {row.oldValue}
                                    </td>
                                    <td className="py-1 px-2 text-muted-foreground/50">
                                        —
                                    </td>
                                </tr>
                            )
                        }

                        // changed : 2 sous-lignes
                        // Tableau (2 <tr>) plutôt qu'un Fragment : le plugin de
                        // dev injecte `data-source` sur tout élément JSX, ce que
                        // React.Fragment refuse.
                        return [
                            <tr
                                key={`${row.key}-old`}
                                className="bg-destructive/10"
                            >
                                <td
                                    className="pt-1 pb-0 px-2 text-muted-foreground font-semibold"
                                    rowSpan={2}
                                >
                                    {row.key}
                                </td>
                                <td className="pt-1 pb-0 px-2 text-destructive line-through break-all">
                                    {row.oldValue}
                                </td>
                                <td className="pt-1 pb-0 px-2 text-muted-foreground/50"></td>
                            </tr>,
                            <tr
                                key={`${row.key}-new`}
                                className="border-b border-border/20 bg-success/10"
                            >
                                <td className="pb-1 pt-0 px-2 text-muted-foreground/50"></td>
                                <td className="pb-1 pt-0 px-2 text-success break-all">
                                    {row.newValue}
                                </td>
                            </tr>,
                        ]
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Badge opération
// ---------------------------------------------------------------------------

const OP_CONFIG: Record<string, { label: string; classes: string }> = {
    INSERT: {
        label: "INSERT",
        classes: "bg-success/10 text-success border-success/20",
    },
    UPDATE: {
        label: "UPDATE",
        classes: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    },
    DELETE: {
        label: "DELETE",
        classes: "bg-destructive/10 text-destructive border-destructive/20",
    },
}

function OperationBadge({ op }: { op: string | null }) {
    const cfg = OP_CONFIG[op ?? ""] ?? {
        label: op ?? "—",
        classes: "bg-muted text-muted-foreground border-border",
    }
    return (
        <span
            className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${cfg.classes}`}
        >
            {cfg.label}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Carte de log
// ---------------------------------------------------------------------------

function CRMLogCard({ log, index }: { log: CRMLog; index: number }) {
    const [expanded, setExpanded] = useState(false)

    const authorName =
        log.changed_by_profile?.full_name ??
        (log.changes_by ? log.changes_by.slice(0, 8) + "…" : "Système")

    const dateStr = new Date(log.change_at ?? "").toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })

    const borderColor =
        log.operation === "INSERT"
            ? "border-l-success"
            : log.operation === "DELETE"
              ? "border-l-destructive"
              : "border-l-chart-2"

    return (
        <div
            style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
            className={`border-l-2 rounded-r-lg mb-2 border border-border/40 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-slow ease-out ${borderColor}`}
        >
            <div
                role="button"
                tabIndex={0}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors rounded-r-lg overflow-hidden"
                onClick={() => setExpanded((p) => !p)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                        setExpanded((p) => !p)
                }}
            >
                <span className="shrink-0 text-muted-foreground">
                    {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                    )}
                </span>

                <OperationBadge op={log.operation} />

                <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">
                    <span className="font-semibold">
                        {log.table_name ?? "?"}
                    </span>
                    {log.row_id && (
                        <span className="text-muted-foreground font-normal">
                            {" "}
                            · {log.row_id}
                        </span>
                    )}
                </span>

                <div className="shrink-0 flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateStr}
                    </span>
                    <span className="hidden sm:flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {authorName}
                    </span>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-border/30 pt-3 pb-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-base ease-out">
                    <div className="px-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Database className="w-3 h-3" />
                            Table :{" "}
                            <strong className="text-foreground">
                                {log.table_name}
                            </strong>
                        </span>
                        {log.row_id && (
                            <span className="break-all">
                                ID :{" "}
                                <span className="font-mono text-foreground">
                                    {log.row_id}
                                </span>
                            </span>
                        )}
                        <span className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            {authorName}
                        </span>
                    </div>
                    <div className="overflow-x-auto px-4">
                        <DiffTable
                            old_data={log.old_data}
                            new_data={log.new_data}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function CRMLogsPanel() {
    const { logs, loading, total, filters, applyFilters, refresh } =
        useLogsCRM()

    const [searchInput, setSearchInput] = useState("")
    const [page, setPage] = useState(0)
    const [tableFilter, setTableFilter] = useState("all")

    // Tables uniques dérivées des logs chargés
    const tableOptions = useMemo(() => {
        const names = new Set(
            logs.map((l) => l.table_name).filter(Boolean) as string[]
        )
        return Array.from(names).sort()
    }, [logs])

    // Filtrage client-side par table
    const filteredLogs = useMemo(
        () =>
            tableFilter === "all"
                ? logs
                : logs.filter((l) => l.table_name === tableFilter),
        [logs, tableFilter]
    )

    const totalPages = Math.ceil(filteredLogs.length / CRM_LOGS_PAGE_SIZE)
    const visibleLogs = filteredLogs.slice(
        page * CRM_LOGS_PAGE_SIZE,
        (page + 1) * CRM_LOGS_PAGE_SIZE
    )

    const handleSearch = (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setPage(0)
        applyFilters({ ...filters, search: searchInput || undefined })
    }

    const handleClearSearch = () => {
        setSearchInput("")
        setPage(0)
        applyFilters({ ...filters, search: undefined })
    }

    const handleOperationChange = (value: string) => {
        setPage(0)
        applyFilters({
            ...filters,
            operation: value as "all" | "INSERT" | "UPDATE" | "DELETE",
        })
    }

    const handleTableChange = (value: string) => {
        setPage(0)
        setTableFilter(value)
    }

    return (
        <div className="flex flex-col gap-4 sm:h-full sm:overflow-hidden">
            {/* Échantillon clients */}
            <ClientSample />

            <div className="border-t border-border/40" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <Database className="w-4 h-4 text-primary" />
                        Logs CRM
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {filteredLogs.length !== total
                            ? `${filteredLogs.length} / ${total} entrées`
                            : `${total} entrée${total > 1 ? "s" : ""}`}
                    </span>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={loading}
                    className="h-8 shrink-0"
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline">Actualiser</span>
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <div className="flex gap-2">
                    {/* Filtre opération */}
                    <Select
                        value={filters.operation ?? "all"}
                        onValueChange={handleOperationChange}
                    >
                        <SelectTrigger className="flex-1 sm:w-36 sm:flex-none h-8 text-xs">
                            <SelectValue placeholder="Opération" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes</SelectItem>
                            <SelectItem value="INSERT">INSERT</SelectItem>
                            <SelectItem value="UPDATE">UPDATE</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filtre table */}
                    <Select
                        value={tableFilter}
                        onValueChange={handleTableChange}
                    >
                        <SelectTrigger className="flex-1 sm:w-44 sm:flex-none h-8 text-xs">
                            <div className="flex items-center gap-1.5 truncate">
                                <Database className="w-3 h-3 shrink-0 text-muted-foreground" />
                                <SelectValue placeholder="Table" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Toutes les tables
                            </SelectItem>
                            {tableOptions.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Recherche texte */}
                <form
                    onSubmit={handleSearch}
                    className="flex items-center gap-1.5 flex-1 min-w-0"
                >
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Table, ID de ligne…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="h-8 text-xs pl-8 pr-6"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <Button
                        type="submit"
                        size="sm"
                        className="h-8 text-xs shrink-0"
                    >
                        Filtrer
                    </Button>
                </form>
            </div>

            {/* List */}
            <div className="sm:flex-1 sm:min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Chargement…
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <EmptyState
                        size="sm"
                        variant="search"
                        icon={Database}
                        title="Aucun log CRM pour ces filtres"
                        description="Élargissez la période ou retirez un filtre."
                        className="h-48 border border-dashed rounded-xl"
                    />
                ) : (
                    <div className="sm:h-full overflow-y-auto overscroll-contain pr-2">
                        {visibleLogs.map((log, index) => (
                            <CRMLogCard key={log.id} log={log} index={index} />
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                        Page {page + 1} / {totalPages} · {filteredLogs.length}{" "}
                        entrées
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="flex-1 sm:flex-none h-7 text-xs"
                        >
                            Précédent
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setPage((p) => Math.min(totalPages - 1, p + 1))
                            }
                            disabled={page >= totalPages - 1}
                            className="flex-1 sm:flex-none h-7 text-xs"
                        >
                            Suivant
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
